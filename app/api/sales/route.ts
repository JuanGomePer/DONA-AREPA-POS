import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, payment, isManagement = false, locator, note } = body;

    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "La caja está cerrada. Debes abrir un turno para vender." },
        { status: 403 }
      );
    }

    const salesInSession = await prisma.sale.count({
      where: { sessionId: activeSession.id }
    });
    const nextTicketNo = salesInSession + 1;

    const dishIds = items.map((i: { dishId: string }) => i.dishId);
    
    // 👇 TRAER RECETAS DE UNA VEZ (antes de la transacción)
    const dbDishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      include: { recipe: true }, // 👈 Incluir recetas aquí
    });

    let totalAmount = 0;
    const itemsWithPrice = items.map((item: { dishId: string; qty: number }) => {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (!dish) throw new Error(`Plato no encontrado: ${item.dishId}`);
      const lineTotal = dish.price * item.qty;
      totalAmount += lineTotal;
      return { dishId: dish.id, qty: item.qty, price: dish.price };
    });

    // 👇 PRE-CALCULAR todos los descuentos de inventario
    const ingredientUpdates = new Map<string, number>();
    
    for (const item of items) {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (dish?.recipe) {
        for (const recipeItem of dish.recipe) {
          const currentQty = ingredientUpdates.get(recipeItem.ingredientId) || 0;
          ingredientUpdates.set(
            recipeItem.ingredientId,
            currentQty + (item.qty * recipeItem.qty)
          );
        }
      }
    }

    // 👇 TRANSACCIÓN MÁS RÁPIDA (solo escrituras)
    const sale = await prisma.$transaction(
      async (tx) => {
        interface SaleItem { dishId: string; qty: number; price: number; }
        interface PaymentData { methodId: string; amount: number; cashReceived?: number | null; changeGiven?: number | null; }

        const saleData: any = {
          ticketNo: nextTicketNo,
          total: totalAmount,
          sessionId: activeSession.id,
          isManagement,
          items: {
            create: itemsWithPrice.map((it: SaleItem) => ({
              dishId: it.dishId,
              qty: it.qty,
              price: it.price,
            })),
          },
        };

        // Solo crear pago si NO es orden de gerencia
        if (!isManagement && payment?.methodId) {
          saleData.payment = {
            create: {
              methodId: payment.methodId,
              amount: totalAmount,
              cashReceived: payment.cashReceived || null,
              changeGiven: payment.cashReceived ? payment.cashReceived - totalAmount : null,
            } as PaymentData,
          };
        }

        const newSale = await tx.sale.create({ data: saleData, include: { items: true } });

        // 👇 BATCH UPDATE de inventario (todas las actualizaciones en paralelo)
        if (ingredientUpdates.size > 0) {
          const updatePromises = Array.from(ingredientUpdates.entries()).map(
            ([ingredientId, qtyToDiscount]) =>
              tx.ingredient.update({
                where: { id: ingredientId },
                data: { stock: { decrement: qtyToDiscount } },
              })
          );
          
          await Promise.all(updatePromises);
        }

        return newSale;
      },
      {
        maxWait: 10000, // Esperar máximo 10s para iniciar
        timeout: 20000, // Timeout total de 20s
      }
    );

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      ticketNo: sale.ticketNo,
    });

  } catch (error: any) {
    console.error("ERROR_VENTA:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la venta" },
      { status: 500 }
    );
  }
}