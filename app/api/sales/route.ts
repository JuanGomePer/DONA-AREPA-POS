import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, payment, isManagement = false } = body;

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
    
    const dbDishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      include: { recipe: true },
    });

    let totalAmount = 0;
    const itemsWithPrice = items.map((item: { dishId: string; qty: number }) => {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (!dish) throw new Error(`Plato no encontrado: ${item.dishId}`);
      totalAmount += dish.price * item.qty;
      return { dishId: dish.id, qty: item.qty, price: dish.price };
    });

    // Calcular totales de ingredientes a descontar
    const ingredientUpdates = new Map<string, number>();
    for (const item of items) {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (dish?.recipe) {
        for (const recipeItem of dish.recipe) {
          const current = ingredientUpdates.get(recipeItem.ingredientId) || 0;
          ingredientUpdates.set(recipeItem.ingredientId, current + (item.qty * recipeItem.qty));
        }
      }
    }

    // 👇 OPTIMIZACIÓN: Traer TODOS los batches ANTES de la transacción
    const ingredientIds = Array.from(ingredientUpdates.keys());
    const allBatches = await prisma.ingredientBatch.findMany({
      where: { 
        ingredientId: { in: ingredientIds },
        qtyRemaining: { gt: 0 }
      },
      orderBy: [
        { ingredientId: 'asc' },
        { createdAt: 'asc' }
      ],
    });

    // Agrupar batches por ingrediente para acceso rápido
    const batchesByIngredient = new Map<string, typeof allBatches>();
    for (const batch of allBatches) {
      if (!batchesByIngredient.has(batch.ingredientId)) {
        batchesByIngredient.set(batch.ingredientId, []);
      }
      batchesByIngredient.get(batch.ingredientId)!.push(batch);
    }

    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear la venta
      const newSale = await tx.sale.create({
        data: {
          ticketNo: nextTicketNo,
          total: totalAmount,
          sessionId: activeSession.id,
          isManagement,
          items: {
            create: itemsWithPrice.map((it: any) => ({
              dishId: it.dishId,
              qty: it.qty,
              price: it.price,
            })),
          },
          payment: (!isManagement && payment?.methodId) ? {
            create: {
              methodId: payment.methodId,
              amount: totalAmount,
              cashReceived: payment.cashReceived || null,
              changeGiven: payment.cashReceived ? payment.cashReceived - totalAmount : null,
            }
          } : undefined,
        }
      });

      // 2. Descontar Inventario y Lotes (FIFO) - OPTIMIZADO SIN QUERIES
      const ingredientUpdatePromises = [];
      const batchUpdatePromises = [];

      for (const [ingredientId, qtyToDiscount] of ingredientUpdates.entries()) {
        // Descuento del stock general
        ingredientUpdatePromises.push(
          tx.ingredient.update({
            where: { id: ingredientId },
            data: { stock: { decrement: qtyToDiscount } },
          })
        );

        // Descuento de lotes FIFO usando los batches pre-cargados
        let remaining = qtyToDiscount;
        const batches = batchesByIngredient.get(ingredientId) || [];

        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.qtyRemaining, remaining);
          
          batchUpdatePromises.push(
            tx.ingredientBatch.update({
              where: { id: batch.id },
              data: { qtyRemaining: { decrement: take } },
            })
          );
          
          remaining -= take;
        }
      }

      // 👇 OPTIMIZACIÓN: Ejecutar todos los updates EN PARALELO
      await Promise.all([...ingredientUpdatePromises, ...batchUpdatePromises]);

      return newSale;
    }, { 
      maxWait: 5000,
      timeout: 10000 
    });

    return NextResponse.json({ success: true, saleId: sale.id, ticketNo: sale.ticketNo });

  } catch (error: any) {
    console.error("ERROR_VENTA:", error);
    return NextResponse.json({ error: error.message || "Error al procesar" }, { status: 500 });
  }
}