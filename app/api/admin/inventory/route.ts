import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

// GET: Listar ingredientes
export async function GET() {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ingredients);
}

// POST: Crear ingrediente nuevo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { name, unit, stock } = await req.json();
  const newIng = await prisma.ingredient.create({
    data: { name, unit, stock: parseFloat(stock) }
  });
  return NextResponse.json(newIng);
}

// PUT: Editar ingrediente (corrección directa del stock)
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, name, unit, stock } = await req.json();
  const updated = await prisma.ingredient.update({
    where: { id },
    data: { name, unit, stock: parseFloat(stock) }
  });
  return NextResponse.json(updated);
}

// PATCH: Sumar stock (reabastecimiento)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, amount } = await req.json();
  const updated = await prisma.ingredient.update({
    where: { id },
    data: { stock: { increment: parseFloat(amount) } } // Prisma suma directamente en DB
  });
  return NextResponse.json(updated);
}

// DELETE: Borrar ingrediente
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

  await prisma.ingredient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}