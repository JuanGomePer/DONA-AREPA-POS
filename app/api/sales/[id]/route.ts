import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> } 
) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id: id },
    include: {
      items: { include: { dish: true } },
      payment: { 
        include: { 
          method: true, 
          cashLines: { include: { denomination: true } } 
        } 
      },
    },
  });

  if (!sale) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(sale);
}