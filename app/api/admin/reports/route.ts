import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const sessions = await prisma.cashSession.findMany({
      where: { status: "CLOSED" },
      include: {
        sales: {
          include: {
            items: { include: { dish: true } },
            payment: { include: { method: true } },
          },
        },
        expenses: true,
      },
      orderBy: { closedAt: "desc" },
    });

    const weeklyMap = new Map<string, any>();
    const monthlyMap = new Map<string, any>();

    for (const sess of sessions) {
      if (!sess.closedAt) continue;

      const closeDate = new Date(sess.closedAt);
      const monday = getMonday(new Date(closeDate));
      const weekKey = `${monday.getFullYear()}-W${String(
        Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      ).padStart(2, "0")}`;

      const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, "0")}`;

      const realSales = sess.sales.filter((s: any) => !s.isManagement);
      const mgmtSales = sess.sales.filter((s: any) => s.isManagement);

      const totalReal = realSales.reduce((acc: number, s: any) => acc + s.total, 0);
      const totalMgmt = mgmtSales.reduce((acc: number, s: any) => acc + s.total, 0);
      const totalExpenses = sess.expenses.reduce((acc: number, e: any) => acc + e.amount, 0);

      // 👇 FIX: Usar qtyInitial en lugar de qtyRemaining
      const batches = await prisma.ingredientBatch.findMany({
        where: {
          createdAt: {
            gte: sess.openedAt,
            lte: sess.closedAt,
          },
        },
        select: {
          qtyInitial: true,    // 👈 CAMBIO CLAVE
          unitCost: true,
        },
      });

      const investment = batches.reduce((acc, b) => {
        const qty = Number(b.qtyInitial || 0);  // 👈 Usar qtyInitial
        const cost = Number(b.unitCost || 0);
        return acc + qty * cost;
      }, 0);

      const profit = totalReal - totalExpenses - investment;

      const byMethod: Record<string, { name: string; amount: number }> = {};
      for (const sale of realSales) {
        if (sale.payment?.method) {
          const mid = sale.payment.methodId;
          if (!byMethod[mid]) byMethod[mid] = { name: sale.payment.method.name, amount: 0 };
          byMethod[mid].amount += sale.payment.amount;
        }
      }

      const sessionData = {
        id: sess.id,
        openedAt: sess.openedAt,
        closedAt: sess.closedAt,
        baseCash: sess.baseCash,
        totalReal,
        investment,
        profit,
        totalMgmt,
        totalExpenses,
        byMethod,
        realCount: realSales.length,
        mgmtCount: mgmtSales.length,
      };

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          weekKey,
          weekStart: new Date(monday),
          sessions: [],
          totalReal: 0,
          totalMgmt: 0,
          totalExpenses: 0,
          totalInvestment: 0,
          profit: 0,
          byMethod: {} as Record<string, { name: string; amount: number }>,
        });
      }
      const week = weeklyMap.get(weekKey);
      week.sessions.push(sessionData);
      week.totalReal += totalReal;
      week.totalMgmt += totalMgmt;
      week.totalExpenses += totalExpenses;
      week.totalInvestment += investment;
      week.profit += profit;

      for (const [mid, data] of Object.entries(byMethod)) {
        if (!week.byMethod[mid]) week.byMethod[mid] = { name: data.name, amount: 0 };
        week.byMethod[mid].amount += data.amount;
      }

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          monthKey,
          year: closeDate.getFullYear(),
          month: closeDate.getMonth() + 1,
          sessions: [],
          totalReal: 0,
          totalMgmt: 0,
          totalExpenses: 0,
          totalInvestment: 0,
          profit: 0,
          byMethod: {} as Record<string, { name: string; amount: number }>,
        });
      }
      const month = monthlyMap.get(monthKey);
      month.sessions.push(sessionData);
      month.totalReal += totalReal;
      month.totalMgmt += totalMgmt;
      month.totalExpenses += totalExpenses;
      month.totalInvestment += investment;
      month.profit += profit;

      for (const [mid, data] of Object.entries(byMethod)) {
        if (!month.byMethod[mid]) month.byMethod[mid] = { name: data.name, amount: 0 };
        month.byMethod[mid].amount += data.amount;
      }
    }

    return NextResponse.json({
      weekly: Array.from(weeklyMap.values()),
      monthly: Array.from(monthlyMap.values()),
    });
  } catch (error) {
    console.error("ERROR_REPORTS:", error);
    return NextResponse.json({ error: "Error al generar reportes" }, { status: 500 });
  }
}