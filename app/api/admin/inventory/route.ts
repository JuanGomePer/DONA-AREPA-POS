import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

export async function GET() {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { name, unit, stock } = await req.json();
  const newIng = await prisma.ingredient.create({
    data: { name, unit, stock: parseFloat(stock) }
  });
  return NextResponse.json(newIng);
}