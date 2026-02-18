import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activeSession = await prisma.cashSession.findFirst({
      where: { status: "OPEN" },
      include: {
        sales: {
          include: {
            payment: { include: { method: true } },
            items: { include: { dish: true } },
          },
        },
        expenses: { orderBy: { createdAt: "asc" } }, // se mantiene para sumar total gasto
      },
    });

    if (!activeSession) return NextResponse.json({ session: null });

    const regularSales = activeSession.sales.filter((s: any) => !s.isManagement);
    const managementSales = activeSession.sales.filter((s: any) => s.isManagement);

    const totalSold = regularSales.reduce((acc: number, s: any) => acc + s.total, 0);

    const byMethod: Record<string, { name: string; amount: number; isCash: boolean }> = {};
    for (const s of regularSales) {
      if (s.payment) {
        const mid = s.payment.methodId;
        if (!byMethod[mid]) {
          byMethod[mid] = {
            name: s.payment.method.name,
            amount: 0,
            isCash: !!s.payment.method.isCash,
          };
        }
        byMethod[mid].amount += s.payment.amount;
      }
    }

    const totalExpenses = activeSession.expenses.reduce((acc: number, e: any) => acc + e.amount, 0);

    return NextResponse.json({
      session: {
        id: activeSession.id,
        openedAt: activeSession.openedAt,
        baseCash: activeSession.baseCash,

        totalSold,
        count: regularSales.length,

        byMethod,

        // ya no usamos la lista en UI, pero la dejamos por si quieres auditoría
        expenses: activeSession.expenses,
        totalExpenses,

        managementOrders: managementSales.map((s: any) => ({
          id: s.id,
          ticketNo: s.ticketNo,
          total: s.total,
          createdAt: s.createdAt,
          items: s.items.map((it: any) => ({
            id: it.id,
            qty: it.qty,
            price: it.price,
            dishName: it.dish.name,
          })),
        })),
        managementCount: managementSales.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "OPEN") {
      const existing = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
      if (existing) return NextResponse.json({ error: "Ya hay una sesión abierta" }, { status: 400 });

      const newSession = await prisma.cashSession.create({
        data: { status: "OPEN", baseCash: parseInt(body.baseCash) || 0 },
      });
      return NextResponse.json(newSession);
    }

    if (action === "CLOSE") {
      const active = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
      if (!active) return NextResponse.json({ error: "No hay sesión activa" }, { status: 400 });

      await prisma.cashSession.update({
        where: { id: active.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "ADD_EXPENSE") {
      const active = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
      if (!active) return NextResponse.json({ error: "No hay sesión activa" }, { status: 400 });

      const amount = parseInt(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
      }

      const expense = await prisma.cashExpense.create({
        data: {
          sessionId: active.id,
          amount,
          // 🔥 ya no pedimos descripción: la dejamos fija
          description: "Gasto",
        },
      });

      return NextResponse.json(expense);
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
