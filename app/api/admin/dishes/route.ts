import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

// Sin importar DishCategory — usamos los strings del enum directamente
const VALID_CATEGORIES = ["STARTER", "MAIN", "DRINK"] as const;
type CategoryKey = typeof VALID_CATEGORIES[number];

const toCategoryEnum = (cat: string): CategoryKey => {
  if (VALID_CATEGORIES.includes(cat as CategoryKey)) {
    return cat as CategoryKey;
  }
  return "MAIN"; // fallback
};

// --- GET: Listar platos ---
export async function GET(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  try {
    const dishes = await prisma.dish.findMany({
      include: { recipe: true },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(dishes);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener platos" }, { status: 500 });
  }
}

// --- POST: Crear plato ---
export async function POST(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { name, price, category, recipe } = await req.json();

  try {
    const newDish = await prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: { 
          name, 
          price: parseFloat(price), 
          category: toCategoryEnum(category),
          enabled: true 
        }
      });

      if (recipe && recipe.length > 0) {
        await tx.recipeItem.createMany({
          data: recipe.map((r: any) => ({
            dishId: dish.id,
            ingredientId: r.ingredientId,
            qty: parseFloat(r.qty)
          }))
        });
      }
      return dish;
    });
    return NextResponse.json(newDish);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}

// --- PUT: Editar plato ---
export async function PUT(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { id, name, price, category, recipe } = await req.json();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id },
        data: { 
          name, 
          price: parseFloat(price),
          category: toCategoryEnum(category)
        }
      });

      await tx.recipeItem.deleteMany({ where: { dishId: id } });
      if (recipe && recipe.length > 0) {
        await tx.recipeItem.createMany({
          data: recipe.map((r: any) => ({
            dishId: id,
            ingredientId: r.ingredientId,
            qty: parseFloat(r.qty)
          }))
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// --- DELETE: Borrar plato ---
export async function DELETE(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID faltante" }, { status: 400 });

  try {
    await prisma.dish.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}