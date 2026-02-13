import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

// --- GET: Listar platos con sus recetas ---
export async function GET() {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const dishes = await prisma.dish.findMany({
      include: { 
        recipe: true // ESENCIAL para que el frontend pueda editar
      },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(dishes);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener platos" }, { status: 500 });
  }
}

// --- POST: Crear plato (Tu código original) ---
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { name, price, recipe } = await req.json();

  try {
    const newDish = await prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: { name, price: parseFloat(price), enabled: true }
      });

      await tx.recipeItem.createMany({
        data: recipe.map((r: any) => ({
          dishId: dish.id,
          ingredientId: r.ingredientId,
          qty: parseFloat(r.qty)
        }))
      });
      return dish;
    });
    return NextResponse.json(newDish);
  } catch (error) {
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

// --- PUT: Editar plato y receta ---
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, name, price, recipe } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar plato
      await tx.dish.update({
        where: { id },
        data: { name, price: parseFloat(price) }
      });

      // 2. Limpiar receta vieja y poner la nueva
      await tx.recipeItem.deleteMany({ where: { dishId: id } });
      await tx.recipeItem.createMany({
        data: recipe.map((r: any) => ({
          dishId: id,
          ingredientId: r.ingredientId,
          qty: parseFloat(r.qty)
        }))
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// --- DELETE: Borrar plato ---
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

  try {
    // Borramos primero la receta por integridad de BD
    await prisma.recipeItem.deleteMany({ where: { dishId: id } });
    await prisma.dish.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}