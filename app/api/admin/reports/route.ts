import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// 👇 FUNCIÓN PARA CALCULAR EL COSTO DE MATERIA PRIMA DE UNA VENTA
async function calculateSaleCost(saleItems: any[]): Promise<number> {
  let totalCost = 0;

  for (const item of saleItems) {
    // Obtener el platillo con su receta
    const dish = await prisma.dish.findUnique({
      where: { id: item.dishId },
      include: {
        recipe: {
          include: {
            ingredient: {
              include: {
                product: true, // Necesitamos el producto para el costo
              },
            },
          },
        },
      },
    });

    if (!dish || !dish.recipe) continue;

    // Por cada ingrediente en la receta
    for (const recipeItem of dish.recipe) {
      const ingredient = recipeItem.ingredient;
      
      // Calcular costo unitario actual
      let unitCost = 0;
      if (ingredient.product && ingredient.product.packQty > 0) {
        unitCost = ingredient.product.packPrice / ingredient.product.packQty;
      }

      // Cantidad consumida = cantidad vendida × cantidad en receta
      const qtyConsumed = item.qty * recipeItem.qty;
      
      // Costo de este ingrediente para esta venta
      totalCost += qtyConsumed * unitCost;
    }
  }

  return totalCost;
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
            items: true, // Solo necesitamos los items
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

      // 👇 CÁLCULO CORRECTO: Sumar el costo de TODAS las ventas (reales + gerencia)
      let investment = 0;
      
      // Calcular costo de ventas reales
      for (const sale of realSales) {
        investment += await calculateSaleCost(sale.items);
      }
      
      // Calcular costo de órdenes de gerencia (también consumen inventario)
      for (const sale of mgmtSales) {
        investment += await calculateSaleCost(sale.items);
      }

      const profit = totalReal - totalExpenses - investment;

      // Desglose por método de pago
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

      // Agrupación Semanal
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

      // Agrupación Mensual
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