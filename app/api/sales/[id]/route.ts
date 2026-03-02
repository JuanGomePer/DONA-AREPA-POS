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

  // 👇 Solo traer lo que realmente necesitas
  const sale = await prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      ticketNo: true,
      total: true,
      createdAt: true,
      isManagement: true,
      items: {
        select: {
          qty: true,
          price: true,
          dish: {
            select: {
              name: true
            }
          }
        }
      },
      payment: {
        select: {
          amount: true,
          cashReceived: true,
          changeGiven: true,
          method: {
            select: {
              name: true,
              isCash: true
            }
          }
        }
      }
    }
  });

  if (!sale) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(sale);
}