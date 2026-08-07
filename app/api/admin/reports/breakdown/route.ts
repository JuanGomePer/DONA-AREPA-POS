import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { coMonthRangeUTC } from "@/lib/date";

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

  // Ventana del mes en hora de Colombia (no del servidor).
  const { start, end } = coMonthRangeUTC(year, month);

  // El consumo se atribuye al mes en que ABRIÓ el turno (la sesión),
  // no a la hora de cada venta. Así una venta de madrugada cuenta en
  // el mismo mes que el resto del turno.
  const items = await prisma.saleItem.findMany({
    where: {
      sale: {
        session: { openedAt: { gte: start, lt: end } },
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
