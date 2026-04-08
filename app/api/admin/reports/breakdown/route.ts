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
      qty:   true,
      price: true,
      cost:  true,
      dish:  { select: { name: true, category: true } },
    },
  });

  // Agrupar por nombre de platillo
  const map = new Map<string, { name: string; category: string; qty: number; revenue: number; cost: number }>();
  for (const item of items) {
    const key = item.dish.name;
    if (!map.has(key)) {
      map.set(key, { name: key, category: item.dish.category, qty: 0, revenue: 0, cost: 0 });
    }
    const entry = map.get(key)!;
    entry.qty     += item.qty;
    entry.revenue += item.price * item.qty;
    entry.cost    += item.cost;
  }

  const result = [...map.values()].sort((a, b) => b.cost - a.cost);
  return NextResponse.json(result);
}
