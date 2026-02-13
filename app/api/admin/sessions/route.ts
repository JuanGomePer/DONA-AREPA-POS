import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sessions = await prisma.cashSession.findMany({
      orderBy: {
        openedAt: 'desc',
      },
      include: {
        sales: {
          include: {
            items: {
              include: {
                dish: true,
              },
            },
            payment: {
              include: {
                method: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(sessions || []);
  } catch (error) {
    console.error("ERROR_GET_SESSIONS:", error);
    return NextResponse.json([], { status: 500 });
  }
}