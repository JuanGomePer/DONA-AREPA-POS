import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, payment, isManagement = false } = body;

    // 👇 Query 1: Session activa
    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
      select: { id: true }, // Solo traer el ID
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "La caja está cerrada. Debes abrir un turno para vender." },
        { status: 403 }
      );
    }

    // 👇 Query 2: Count de ventas
    const salesInSession = await prisma.sale.count({
      where: { sessionId: activeSession.id }
    });
    const nextTicketNo = salesInSession + 1;

    const dishIds = items.map((i: { dishId: string }) => i.dishId);
    
    // 👇 Query 3: Platillos con recetas
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

    // 👇 PRE-CALCULAR descuentos de ingredientes
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

    // 👇 Query 4: Traer TODOS los batches necesarios DE UNA VEZ
    const ingredientIds = Array.from(ingredientUpdates.keys());
    const allBatches = await prisma.ingredientBatch.findMany({
      where: { 
        ingredientId: { in: ingredientIds },
        qtyRemaining: { gt: 0 }
      },
      orderBy: [
        { ingredientId: 'asc' },
        { createdAt: 'asc' } // FIFO por ingrediente
      ],
    });

    // 👇 Agrupar batches por ingrediente
    const batchesByIngredient = new Map<string, typeof allBatches>();
    for (const batch of allBatches) {
      if (!batchesByIngredient.has(batch.ingredientId)) {
        batchesByIngredient.set(batch.ingredientId, []);
      }
      batchesByIngredient.get(batch.ingredientId)!.push(batch);
    }

    // 👇 Pre-calcular TODOS los updates de batches
    const batchUpdates: { id: string; newQty: number }[] = [];
    
    for (const [ingredientId, qtyToDiscount] of ingredientUpdates.entries()) {
      const batches = batchesByIngredient.get(ingredientId) || [];
      let remaining = qtyToDiscount;

      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(batch.qtyRemaining, remaining);
        
        batchUpdates.push({
          id: batch.id,
          newQty: batch.qtyRemaining - take
        });
        
        remaining -= take;
      }
    }

    // 👇 TRANSACCIÓN SUPER RÁPIDA (solo escrituras, sin queries)
    const sale = await prisma.$transaction(
      async (tx) => {
        // 1. Crear venta (1 query)
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
          },
          select: { id: true, ticketNo: true } // Solo traer lo necesario
        });

        // 2. Descontar stocks de ingredientes EN PARALELO (1 query por ingrediente en paralelo)
        const ingredientUpdatePromises = Array.from(ingredientUpdates.entries()).map(
          ([ingredientId, qty]) => 
            tx.ingredient.update({
              where: { id: ingredientId },
              data: { stock: { decrement: qty } },
            })
        );

        // 3. Actualizar batches EN PARALELO (1 query por batch en paralelo)
        const batchUpdatePromises = batchUpdates.map(
          ({ id, newQty }) =>
            tx.ingredientBatch.update({
              where: { id },
              data: { qtyRemaining: newQty },
            })
        );

        // 4. Ejecutar TODO en paralelo
        await Promise.all([
          ...ingredientUpdatePromises,
          ...batchUpdatePromises
        ]);

        return newSale;
      },
      { 
        maxWait: 5000,
        timeout: 10000
      }
    );

    return NextResponse.json({ 
      success: true, 
      saleId: sale.id, 
      ticketNo: sale.ticketNo 
    });

  } catch (error: any) {
    console.error("ERROR_VENTA:", error);
    return NextResponse.json({ 
      error: error.message || "Error al procesar" 
    }, { status: 500 });
  }
}