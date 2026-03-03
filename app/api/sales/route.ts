import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log("🔵 [VENTA] Inicio del proceso");
  
  try {
    // PASO 1: Parse body
    const t1 = Date.now();
    const body = await req.json();
    const { items, payment, isManagement = false } = body;
    console.log(`⏱️ [VENTA] Parse body: ${Date.now() - t1}ms`);

    // PASO 2: Buscar sesión activa
    const t2 = Date.now();
    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
    });
    console.log(`⏱️ [VENTA] Buscar sesión: ${Date.now() - t2}ms`);

    if (!activeSession) {
      return NextResponse.json(
        { error: "La caja está cerrada. Debes abrir un turno para vender." },
        { status: 403 }
      );
    }

    // PASO 3: Contar ventas en sesión
    const t3 = Date.now();
    const salesInSession = await prisma.sale.count({
      where: { sessionId: activeSession.id }
    });
    const nextTicketNo = salesInSession + 1;
    console.log(`⏱️ [VENTA] Count ventas: ${Date.now() - t3}ms`);

    // PASO 4: Obtener platillos
    const t4 = Date.now();
    const dishIds = items.map((i: { dishId: string }) => i.dishId);
    const dbDishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      include: { recipe: true },
    });
    console.log(`⏱️ [VENTA] Fetch platillos (${dishIds.length}): ${Date.now() - t4}ms`);

    // PASO 5: Calcular precios
    const t5 = Date.now();
    let totalAmount = 0;
    const itemsWithPrice = items.map((item: { dishId: string; qty: number }) => {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (!dish) throw new Error(`Plato no encontrado: ${item.dishId}`);
      totalAmount += dish.price * item.qty;
      return { dishId: dish.id, qty: item.qty, price: dish.price, dishName: dish.name };
    });
    console.log(`⏱️ [VENTA] Calcular precios: ${Date.now() - t5}ms`);

    // PASO 6: Calcular ingredientes
    const t6 = Date.now();
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
    console.log(`⏱️ [VENTA] Calcular ingredientes (${ingredientUpdates.size}): ${Date.now() - t6}ms`);

    // PASO 7: Obtener batches
    const t7 = Date.now();
    const ingredientIds = Array.from(ingredientUpdates.keys());
    const allBatches = ingredientIds.length > 0 ? await prisma.ingredientBatch.findMany({
      where: { 
        ingredientId: { in: ingredientIds },
        qtyRemaining: { gt: 0 }
      },
      orderBy: [
        { ingredientId: 'asc' },
        { createdAt: 'asc' }
      ],
    }) : [];
    console.log(`⏱️ [VENTA] Fetch batches (${allBatches.length}): ${Date.now() - t7}ms`);

    // PASO 8: Agrupar batches
    const t8 = Date.now();
    const batchesByIngredient = new Map<string, typeof allBatches>();
    for (const batch of allBatches) {
      if (!batchesByIngredient.has(batch.ingredientId)) {
        batchesByIngredient.set(batch.ingredientId, []);
      }
      batchesByIngredient.get(batch.ingredientId)!.push(batch);
    }
    console.log(`⏱️ [VENTA] Agrupar batches: ${Date.now() - t8}ms`);

    // PASO 9: TRANSACCIÓN - Crear venta
    const t9 = Date.now();
    console.log("🟡 [VENTA] Iniciando transacción...");
    const sale = await prisma.$transaction(
      async (tx) => {
        const txStart = Date.now();
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
          select: { id: true, ticketNo: true, createdAt: true }
        });
        console.log(`  ⏱️ [TX] Sale.create dentro de TX: ${Date.now() - txStart}ms`);
        return newSale;
      },
      { 
        maxWait: 3000,
        timeout: 5000
      }
    );
    console.log(`⏱️ [VENTA] Transacción completa: ${Date.now() - t9}ms`);

    // PASO 10: Descuentos de inventario (fuera de TX)
    const t10 = Date.now();
    console.log("🟢 [VENTA] Iniciando descuentos de inventario...");
    try {
      const ingredientUpdatePromises = [];
      const batchUpdatePromises = [];

      for (const [ingredientId, qtyToDiscount] of ingredientUpdates.entries()) {
        ingredientUpdatePromises.push(
          prisma.ingredient.update({
            where: { id: ingredientId },
            data: { stock: { decrement: qtyToDiscount } },
          })
        );

        let remaining = qtyToDiscount;
        const batches = batchesByIngredient.get(ingredientId) || [];

        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.qtyRemaining, remaining);
          
          batchUpdatePromises.push(
            prisma.ingredientBatch.update({
              where: { id: batch.id },
              data: { qtyRemaining: { decrement: take } },
            })
          );
          
          remaining -= take;
        }
      }

      console.log(`  📊 [VENTA] Updates programados: ${ingredientUpdatePromises.length} ingredientes, ${batchUpdatePromises.length} batches`);
      await Promise.all([...ingredientUpdatePromises, ...batchUpdatePromises]);
      console.log(`⏱️ [VENTA] Descuentos inventario: ${Date.now() - t10}ms`);
    } catch (inventoryError) {
      console.error("❌ [VENTA] ERROR_DESCUENTO_INVENTARIO:", inventoryError);
    }

    // PASO 11: Obtener método de pago
    const t11 = Date.now();
    let paymentMethod = null;
    if (!isManagement && payment?.methodId) {
      paymentMethod = await prisma.paymentMethod.findUnique({
        where: { id: payment.methodId },
        select: { name: true, isCash: true }
      });
    }
    console.log(`⏱️ [VENTA] Fetch payment method: ${Date.now() - t11}ms`);

    // PASO 12: Preparar respuesta
    const t12 = Date.now();
    const response = { 
      success: true, 
      saleId: sale.id, 
      ticketNo: sale.ticketNo,
      sale: {
        id: sale.id,
        ticketNo: sale.ticketNo,
        total: totalAmount,
        createdAt: sale.createdAt,
        isManagement,
        items: itemsWithPrice.map((it: any) => ({
          qty: it.qty,
          price: it.price,
          dish: { name: it.dishName }
        })),
        payment: (!isManagement && payment?.methodId) ? {
          amount: totalAmount,
          cashReceived: payment.cashReceived || null,
          changeGiven: payment.cashReceived ? payment.cashReceived - totalAmount : null,
          method: paymentMethod
        } : null
      }
    };
    console.log(`⏱️ [VENTA] Preparar respuesta: ${Date.now() - t12}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`✅ [VENTA] COMPLETADO en ${totalTime}ms`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json(response);

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [VENTA] ERROR después de ${totalTime}ms:`, error);
    return NextResponse.json({ error: error.message || "Error al procesar" }, { status: 500 });
  }
}