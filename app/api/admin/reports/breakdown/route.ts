import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year  = parseInt(searchParams.get("year")  ?? "");

  if (!month || !year) {
    return NextResponse.json({ error: "Faltan mes y año" }, { status: 400 });
  }

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        createdAt:    { gte: start, lt: end },
        isManagement: false,
      },
    },
    select: {
      qty:  true,
      dish: {
        select: {
          recipe: {
            select: {
              qty: true,
              ingredient: {
                select: {
                  name: true,
                  unit: true,
                  product: { select: { packPrice: true, packQty: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Agrupar por ingrediente: qty consumida y costo total
  const map = new Map<string, { name: string; unit: string; qty: number; cost: number }>();

  for (const saleItem of items) {
    for (const ri of saleItem.dish.recipe) {
      const ing     = ri.ingredient;
      const totalQty = ri.qty * saleItem.qty;
      const unitCost = ing.product && ing.product.packQty > 0
        ? ing.product.packPrice / ing.product.packQty
        : 0;

      if (!map.has(ing.name)) {
        map.set(ing.name, { name: ing.name, unit: ing.unit, qty: 0, cost: 0 });
      }
      const entry = map.get(ing.name)!;
      entry.qty  += totalQty;
      entry.cost += totalQty * unitCost;
    }
  }

  const result = [...map.values()]
    .sort((a, b) => b.cost - a.cost)
    .map(e => ({ ...e, cost: Math.round(e.cost) }));

  return NextResponse.json(result);
}
