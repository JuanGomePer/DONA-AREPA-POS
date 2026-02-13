import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

export async function GET() {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sales = await prisma.sale.findMany({
    include: {
      items: { include: { dish: true } },
      payment: { include: { method: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(sales);
}