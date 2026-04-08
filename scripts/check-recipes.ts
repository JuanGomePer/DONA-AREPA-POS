import { prisma } from "../lib/prisma";

async function main() {
  // Platos con PORCION CONTABLE SALSAS o SERVICIO en receta
  const withSpecial = await prisma.dish.findMany({
    where: {
      recipe: {
        some: {
          ingredient: { name: { in: ["PORCION CONTABLE SALSAS", "SERVICIO"] } },
        },
      },
    },
    select: {
      id: true, name: true, price: true, category: true,
      recipe: {
        select: {
          qty: true,
          ingredient: { select: { name: true } },
        },
      },
    },
  });

  // Todos los platos de comida (no bebidas)
  const allFood = await prisma.dish.findMany({
    where: { category: { not: "DRINK" }, enabled: true },
    select: { id: true, name: true, price: true, category: true },
    take: 20,
  });

  console.log("=== PLATILLOS CON SALSAS/SERVICIO EN RECETA ===");
  if (withSpecial.length === 0) {
    console.log("  (ninguno todavía)");
  } else {
    withSpecial.forEach(d => {
      console.log(`  ${d.name} ($${d.price})`);
      d.recipe.forEach(r => console.log(`    - ${r.qty}x ${r.ingredient.name}`));
    });
  }

  console.log("\n=== TODOS LOS PLATILLOS DE COMIDA (primeros 20) ===");
  allFood.forEach(d => console.log(`  ${d.id} | ${d.category} | ${d.name} | $${d.price}`));

  await prisma.$disconnect();
}

main().catch(console.error);
