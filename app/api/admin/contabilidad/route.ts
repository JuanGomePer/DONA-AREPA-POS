import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.role || session.role !== "ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (!month || !year) return NextResponse.json({ error: "Faltan mes y año" }, { status: 400 });

  const expenses = await prisma.operatingExpense.findMany({
    where: { month, year },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { description, amount, month, year } = await req.json();
  if (!description || !amount || !month || !year) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const created = await prisma.operatingExpense.create({
    data: {
      description: String(description),
      amount: parseInt(String(amount)),
      month: parseInt(String(month)),
      year: parseInt(String(year)),
    },
  });

  return NextResponse.json(created);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

  await prisma.operatingExpense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
