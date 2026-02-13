import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // @ts-ignore
    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
      include: {
        sales: { include: { payment: true } }
      }
    });

    if (!activeSession) {
      return NextResponse.json({ session: null });
    }

    const totalSold = activeSession.sales.reduce((acc: number, s: any) => acc + s.total, 0);
    
    const byMethod = activeSession.sales.reduce((acc: Record<string, number>, s: any) => {
      if (s.payment) {
        acc[s.payment.methodId] = (acc[s.payment.methodId] || 0) + s.payment.amount;
      }
      return acc;
    }, {});

    return NextResponse.json({
      session: {
        id: activeSession.id,
        openedAt: activeSession.openedAt,
        totalSold,
        count: activeSession.sales.length,
        byMethod
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { action } = await req.json();

  try {
    if (action === "OPEN") {
      // @ts-ignore
      const existing = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
      if (existing) return NextResponse.json({ error: "Ya hay una sesión abierta" }, { status: 400 });

      // @ts-ignore
      const newSession = await prisma.cashSession.create({ data: { status: "OPEN" } });
      return NextResponse.json(newSession);
    }

    if (action === "CLOSE") {
      // @ts-ignore
      const active = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
      if (!active) return NextResponse.json({ error: "No hay sesión activa" }, { status: 400 });

      // @ts-ignore
      await prisma.cashSession.update({
        where: { id: active.id },
        data: { status: "CLOSED", closedAt: new Date() }
      });
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}