import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  if (session!.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const rows = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: {
      product: true,
      batches: {
        orderBy: { createdAt: "desc" },
        take: 10, // últimos 10 lotes para depurar
      },
    },
  });

  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  if (session!.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ingredientId = String(body?.ingredientId || "");
  const packPrice = Number(body?.packPrice);
  const packQty = Number(body?.packQty);

  if (!ingredientId) {
    return NextResponse.json({ error: "ingredientId requerido" }, { status: 400 });
  }
  if (!Number.isFinite(packPrice) || packPrice < 0) {
    return NextResponse.json({ error: "packPrice inválido (>=0)" }, { status: 400 });
  }
  if (!Number.isFinite(packQty) || packQty <= 0) {
    return NextResponse.json({ error: "packQty inválido (>0)" }, { status: 400 });
  }

  await prisma.ingredientProduct.upsert({
    where: { ingredientId },
    update: { packPrice: Math.trunc(packPrice), packQty },
    create: { ingredientId, packPrice: Math.trunc(packPrice), packQty },
  });

  const updated = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: {
      product: true,
      batches: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  return NextResponse.json(updated);
}
