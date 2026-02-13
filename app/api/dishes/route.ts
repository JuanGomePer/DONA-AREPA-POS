import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";

// Función auxiliar para validar que sea ADMIN
async function checkAdmin() {
  const session = await getSession();
  if (session.role !== "ADMIN") {
    return { authorized: false, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { authorized: true };
}

export async function GET() {
  const auth = await checkAdmin();
  if (!auth.authorized) return auth.response;

  const dishes = await prisma.dish.findMany({
    include: {
      recipe: {
        include: { ingredient: true }
      }
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(dishes);
}

export async function POST(req: NextRequest) {
  const auth = await checkAdmin();
  if (!auth.authorized) return auth.response;

  const { name, price, recipe } = await req.json();

  try {
    const dish = await prisma.$transaction(async (tx) => {
      const newDish = await tx.dish.create({
        data: { name, price: parseFloat(price), enabled: true },
      });

      await tx.recipeItem.createMany({
        data: recipe.map((r: any) => ({
          dishId: newDish.id,
          ingredientId: r.ingredientId,
          qty: parseFloat(r.qty),
        })),
      });
      return newDish;
    });
    return NextResponse.json(dish);
  } catch (e) {
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await checkAdmin();
  if (!auth.authorized) return auth.response;

  const { id, name, price, recipe } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id },
        data: { name, price: parseFloat(price) },
      });

      // Borramos la receta vieja y creamos la nueva
      await tx.recipeItem.deleteMany({ where: { dishId: id } });
      await tx.recipeItem.createMany({
        data: recipe.map((r: any) => ({
          dishId: id,
          ingredientId: r.ingredientId,
          qty: parseFloat(r.qty),
        })),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await checkAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Falta ID" }, { status: 400 });

  try {
    // Al borrar el plato, Prisma borrará los RecipeItems por la relación Cascade (si está configurada)
    // Si no, borramos manualmente primero:
    await prisma.recipeItem.deleteMany({ where: { dishId: id } });
    await prisma.dish.delete({ where: { id } });
    
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}