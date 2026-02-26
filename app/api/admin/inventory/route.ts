import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

/** Helpers */
function asNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
}

function roundCost(n: number) {
  return Number(n.toFixed(6));
}

async function requireAdmin() {
  const session = await getSession();
  if (!session?.role || session.role !== "ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: { product: true },
  });

  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { name, unit, stock } = await req.json();
  const stockNum = asNumber(stock);
  if (!name || !unit || !Number.isFinite(stockNum) || stockNum < 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.create({
      data: { name: String(name), unit: String(unit), stock: stockNum },
    });

    if (stockNum > 0) {
      await tx.ingredientBatch.create({
        data: { 
          ingredientId: ing.id, 
          qtyinitial: stockNum,
          qtyRemaining: stockNum, 
          unitCost: 0 
        },
      });
    }

    return ing;
  });

  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { id, name, unit, stock } = await req.json();
  const stockNum = asNumber(stock);
  if (!id || !name || !unit || !Number.isFinite(stockNum) || stockNum < 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.update({
      where: { id: String(id) },
      data: { name: String(name), unit: String(unit), stock: stockNum },
      include: { product: true },
    });

    const agg = await tx.ingredientBatch.aggregate({
      where: { ingredientId: ing.id },
      _sum: { qtyRemaining: true },
    });
    const sumBatches = agg._sum.qtyRemaining ?? 0;
    const diff = stockNum - sumBatches;

    const currentUnitCost =
      ing.product && ing.product.packQty > 0 ? roundCost(ing.product.packPrice / ing.product.packQty) : 0;

    if (Math.abs(diff) < 1e-9) {
      return ing;
    }

    if (diff > 0) {
      await tx.ingredientBatch.create({
        data: {
          ingredientId: ing.id,
          qtyinitial: diff,
          qtyRemaining: diff,
          unitCost: currentUnitCost,
        },
      });
      return ing;
    }

    // Si la diferencia es negativa, quitamos de los lotes empezando por el más RECIENTE (ajuste manual)
    let toRemove = -diff;
    const batches = await tx.ingredientBatch.findMany({
      where: { ingredientId: ing.id, qtyRemaining: { gt: 0 } },
      orderBy: { createdAt: "desc" },
    });

    for (const b of batches) {
      if (toRemove <= 0) break;
      const take = Math.min(toRemove, b.qtyRemaining);

      await tx.ingredientBatch.update({
        where: { id: b.id },
        data: { 
            qtyRemaining: { decrement: take },
            // En ajustes manuales negativos, también bajamos el inicial para no falsear inversión
            qtyinitial: { decrement: take } 
        },
      });

      toRemove -= take;
    }

    return ing;
  });

  return NextResponse.json(updated);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { id, amount } = await req.json();
  const amountNum = asNumber(amount);

  if (!id || !Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.findUnique({
      where: { id: String(id) },
      include: { product: true },
    });

    if (!ing) return { error: "Ingrediente no encontrado", status: 404 as const };

    if (!ing.product || ing.product.packQty <= 0 || ing.product.packPrice < 0) {
      return { error: "Configura el producto (precio y porciones) antes de reabastecer", status: 400 as const };
    }

    const unitCost = roundCost(ing.product.packPrice / ing.product.packQty);

    await tx.ingredient.update({
      where: { id: ing.id },
      data: { stock: { increment: amountNum } },
    });

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const lastSameCost = await tx.ingredientBatch.findFirst({
      where: {
        ingredientId: ing.id,
        unitCost,
        createdAt: { gte: since },
        qtyRemaining: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastSameCost) {
      await tx.ingredientBatch.update({
        where: { id: lastSameCost.id },
        data: { 
          qtyinitial: { increment: amountNum },
          qtyRemaining: { increment: amountNum } 
        },
      });
    } else {
      await tx.ingredientBatch.create({
        data: { 
          ingredientId: ing.id, 
          qtyinitial: amountNum,
          qtyRemaining: amountNum, 
          unitCost 
        },
      });
    }

    const updated = await tx.ingredient.findUnique({
      where: { id: ing.id },
      include: { product: true },
    });

    return { ok: true as const, updated };
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

  try {
    const recipesCount = await prisma.recipeItem.count({
      where: { ingredientId: id }
    });

    if (recipesCount > 0) {
      return NextResponse.json({ 
        error: "No se puede eliminar: este ingrediente está en uso en recetas de platillos" 
      }, { status: 400 });
    }

    await prisma.ingredient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error al eliminar ingrediente:", error);
    return NextResponse.json({ error: "Error al eliminar ingrediente" }, { status: 500 });
  }
}