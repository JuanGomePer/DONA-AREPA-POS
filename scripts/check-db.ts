import { prisma } from "../lib/prisma";

async function main() {
  const [dishes, ingredients, sessions, methods] = await Promise.all([
    prisma.dish.findMany({ select: { id: true, name: true, enabled: true }, take: 10 }),
    prisma.ingredient.findMany({
      select: { id: true, name: true, stock: true, product: { select: { packPrice: true, packQty: true } } },
      where: { name: { in: ["PORCION CONTABLE SALSAS", "SERVICIO"] } },
    }),
    prisma.cashSession.findMany({ select: { id: true, status: true, openedAt: true }, orderBy: { openedAt: "desc" }, take: 5 }),
    prisma.paymentMethod.findMany({ select: { id: true, name: true, isCash: true, enabled: true } }),
  ]);
  console.log("=== DISHES (primeros 10) ===");
  dishes.forEach(d => console.log(`  ${d.id} | ${d.name} | enabled:${d.enabled}`));
  console.log("\n=== INGREDIENTES ESPECIALES ===");
  console.log(JSON.stringify(ingredients, null, 2));
  console.log("\n=== SESIONES RECIENTES ===");
  sessions.forEach(s => console.log(`  ${s.id} | ${s.status} | ${s.openedAt}`));
  console.log("\n=== MÉTODOS DE PAGO ===");
  methods.forEach(m => console.log(`  ${m.id} | ${m.name} | cash:${m.isCash} | enabled:${m.enabled}`));
  await prisma.$disconnect();
}

main().catch(console.error);
