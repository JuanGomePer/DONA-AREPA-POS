import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, payments, isManagement = false, customItems = [], note = "", locator = "" } = body;

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
      where: { sessionId: activeSession.id },
    });
    const nextTicketNo = salesInSession + 1;

    // ── Cargar platos y sus recetas ───────────────────────────────────────────
    const dishIds = items.map((i: { dishId: string }) => i.dishId);
    const dbDishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      include: {
        recipe: {
          include: {
            ingredient: { include: { product: true } },
          },
        },
      },
    });

    let totalAmount = 0;
    let totalCost = 0;

    const itemsWithPrice = items.map((item: { dishId: string; qty: number }) => {
      const dish = dbDishes.find((d) => d.id === item.dishId);
      if (!dish) throw new Error(`Plato no encontrado: ${item.dishId}`);
      totalAmount += dish.price * item.qty;

      // Calcular costo por ítem para el desglose
      let itemCost = 0;
      for (const ri of dish.recipe) {
        const product = ri.ingredient?.product;
        if (product && product.packQty > 0) {
          itemCost += (product.packPrice / product.packQty) * ri.qty * item.qty;
        }
      }
      totalCost += itemCost;

      return { dishId: dish.id, qty: item.qty, price: dish.price, dishName: dish.name, cost: Math.round(itemCost) };
    });

    // ── Procesar platos personalizados ────────────────────────────────────────
    // El costo se calcula desde los ingredientes enviados por el app.
    // No se crea ningún Dish — el nombre queda en la nota del pedido.
    if (customItems.length > 0) {
      const customIngIds = customItems.flatMap((ci: any) =>
        (ci.ingredients ?? []).map((ing: any) => ing.ingredientId)
      );
      const customIngredients =
        customIngIds.length > 0
          ? await prisma.ingredient.findMany({
              where: { id: { in: customIngIds } },
              include: { product: true },
            })
          : [];

      for (const ci of customItems) {
        // Sumar precio al total
        totalAmount += Math.round(ci.price);

        // Calcular costo de ingredientes del personalizado
        for (const line of ci.ingredients ?? []) {
          const ing = customIngredients.find((i: any) => i.id === line.ingredientId);
          const product = ing?.product;
          if (product && product.packQty > 0) {
            const unitCost = product.packPrice / product.packQty;
            totalCost += unitCost * line.qty;
          }
        }
      }
    }

    // ── Preparar descuento de inventario ──────────────────────────────────────
    const ingredientUpdates = new Map<string, number>();
    for (const item of items) {
      const dish = dbDishes.find((d: any) => d.id === item.dishId);
      if (dish?.recipe) {
        for (const recipeItem of dish.recipe) {
          const current = ingredientUpdates.get(recipeItem.ingredientId) || 0;
          ingredientUpdates.set(recipeItem.ingredientId, current + item.qty * recipeItem.qty);
        }
      }
    }
    // También descontar ingredientes de personalizados
    for (const ci of customItems) {
      for (const line of ci.ingredients ?? []) {
        const current = ingredientUpdates.get(line.ingredientId) || 0;
        ingredientUpdates.set(line.ingredientId, current + line.qty);
      }
    }

    const ingredientIds = Array.from(ingredientUpdates.keys());
    const allBatches =
      ingredientIds.length > 0
        ? await prisma.ingredientBatch.findMany({
            where: { ingredientId: { in: ingredientIds }, qtyRemaining: { gt: 0 } },
            orderBy: [{ ingredientId: "asc" }, { createdAt: "asc" }],
          })
        : [];

    const batchesByIngredient = new Map<string, typeof allBatches>();
    for (const batch of allBatches) {
      if (!batchesByIngredient.has(batch.ingredientId))
        batchesByIngredient.set(batch.ingredientId, []);
      batchesByIngredient.get(batch.ingredientId)!.push(batch);
    }

    // ── TRANSACCIÓN: crear venta + pagos ──────────────────────────────────────
    const sale = await prisma.$transaction(
      async (tx) => {
        const newSale = await tx.sale.create({
          data: {
            ticketNo: nextTicketNo,
            total: totalAmount,
            cost: Math.round(totalCost),   // ← guardado de una vez, para siempre
            sessionId: activeSession.id,
            isManagement,
            items: {
              create: itemsWithPrice.map((it: any) => ({
                dishId: it.dishId,
                qty: it.qty,
                price: it.price,
                cost: it.cost,
              })),
            },
            payments: (!isManagement && payments?.length > 0)
              ? {
                  create: payments.map((p: any) => ({
                    methodId: p.methodId,
                    amount: p.amount,
                    cashReceived: p.cashReceived || null,
                    changeGiven:
                      p.cashReceived && p.cashReceived > p.amount
                        ? p.cashReceived - p.amount
                        : null,
                  })),
                }
              : undefined,
          },
          select: { id: true, ticketNo: true, createdAt: true },
        });
        return newSale;
      },
      { maxWait: 3000, timeout: 5000 }
    );

    // ── Descuento de inventario (fuera de transacción) ────────────────────────
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
        for (const batch of batchesByIngredient.get(ingredientId) || []) {
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
      await Promise.all([...ingredientUpdatePromises, ...batchUpdatePromises]);
    } catch (inventoryError) {
      console.error("ERROR_DESCUENTO_INVENTARIO:", inventoryError);
    }

    // ── Respuesta ─────────────────────────────────────────────────────────────
    let paymentDetails = null;
    if (!isManagement && payments?.length > 0) {
      const methodIds = payments.map((p: any) => p.methodId);
      const methods = await prisma.paymentMethod.findMany({
        where: { id: { in: methodIds } },
        select: { id: true, name: true, isCash: true },
      });
      paymentDetails = payments.map((p: any) => ({
        amount: p.amount,
        cashReceived: p.cashReceived || null,
        changeGiven:
          p.cashReceived && p.cashReceived > p.amount ? p.cashReceived - p.amount : null,
        method: methods.find((m) => m.id === p.methodId) || null,
      }));
    }

    // Construir items de respuesta incluyendo los personalizados
    const responseItems = [
      ...itemsWithPrice.map((it: any) => ({
        qty: it.qty,
        price: it.price,
        dish: { name: it.dishName },
      })),
      ...(customItems ?? []).map((ci: any) => ({
        qty: 1,
        price: Math.round(ci.price),
        dish: { name: ci.name },
      })),
    ];

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      ticketNo: sale.ticketNo,
      sale: {
        id: sale.id,
        ticketNo: sale.ticketNo,
        total: totalAmount,
        createdAt: sale.createdAt,
        isManagement,
        items: responseItems,
        payments: paymentDetails,
      },
    });
  } catch (error: any) {
    console.error("ERROR_VENTA:", error);
    return NextResponse.json({ error: error.message || "Error al procesar" }, { status: 500 });
  }
}