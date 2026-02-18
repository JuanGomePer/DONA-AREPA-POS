import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const sessions = await prisma.cashSession.findMany({
      orderBy: { openedAt: "desc" },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { dish: true } },
            payment: { include: { method: true } },
          },
        },
      },
    });

    const payload = (sessions || []).map((cs: any) => {
      const sales = cs.sales || [];
      const salesReal = sales.filter((s: any) => !s.isManagement);
      const salesManagement = sales.filter((s: any) => s.isManagement);

      const totalReal = salesReal.reduce((acc: number, s: any) => acc + (s.total || 0), 0);

      return {
        id: cs.id,
        openedAt: cs.openedAt,
        closedAt: cs.closedAt,
        status: cs.status,
        baseCash: cs.baseCash,

        // ✅ para el admin: total recaudado SOLO de ventas reales
        totalReal,

        // ✅ listas separadas para mostrar
        salesReal,
        salesManagement,

        // (opcional) si quieres mantenerlo por compatibilidad/debug
        // sales,
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("ERROR_GET_SESSIONS:", error);
    return NextResponse.json([], { status: 500 });
  }
}
