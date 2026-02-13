import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, payment } = body; 

    // 1. VALIDAR SESIÓN DE CAJA ACTIVA
    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "La caja está cerrada. Debes abrir un turno para vender." },
        { status: 403 }
      );
    }

    // 2. LÓGICA DE REINICIO DE TICKET POR SESIÓN
    // Contamos cuántas ventas hay en esta sesión actual y sumamos 1
    const salesInSession = await prisma.sale.count({
      where: { sessionId: activeSession.id }
    });
    const nextTicketNo = salesInSession + 1;

    const dishIds = items.map((i: { dishId: string }) => i.dishId);
    const dbDishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
    });

    let totalAmount = 0;
    const itemsWithPrice = items.map((item: { dishId: string, qty: number }) => {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (!dish) throw new Error(`Plato no encontrado: ${item.dishId}`);
      const lineTotal = dish.price * item.qty;
      totalAmount += lineTotal;
      return {
        dishId: dish.id,
        qty: item.qty,
        price: dish.price,
      };
    });

    // --- INICIO DE LA TRANSACCIÓN ---
    const sale = await prisma.$transaction(async (tx) => {
      interface SaleItem { dishId: string; qty: number; price: number; }
      interface PaymentData { methodId: string; amount: number; cashReceived?: number | null; changeGiven?: number | null; }

      const newSale = await tx.sale.create({
        data: {
          ticketNo: nextTicketNo, // Usamos el número calculado de la sesión
          total: totalAmount,
          sessionId: activeSession.id,
          items: {
            create: itemsWithPrice.map((it: SaleItem) => ({
              dishId: it.dishId,
              qty: it.qty,
              price: it.price,
            })),
          },
          payment: {
            create: {
              methodId: payment.methodId,
              amount: totalAmount,
              cashReceived: payment.cashReceived || null,
              changeGiven: payment.cashReceived ? payment.cashReceived - totalAmount : null,
            } as PaymentData,
          },
        },
        include: { items: true },
      });

      for (const item of itemsWithPrice) {
        const dishWithRecipe = await tx.dish.findUnique({
          where: { id: item.dishId },
          include: { recipe: true },
        });

        if (dishWithRecipe?.recipe) {
          for (const recipeItem of dishWithRecipe.recipe) {
            const discountQty = item.qty * recipeItem.qty;
            await tx.ingredient.update({
              where: { id: recipeItem.ingredientId },
              data: { stock: { decrement: discountQty } },
            });
          }
        }
      }
      return newSale;
    });

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