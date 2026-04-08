/**
 * Script de test end-to-end:
 * 1. Abre una sesión de caja
 * 2. Crea 3 ventas (con platillos que usen SALSAS y SERVICIO si los tienen)
 * 3. Cierra la sesión
 * 4. Agrega gastos operativos al mes actual
 * 5. Verifica reportes y stock de ingredientes especiales
 */

import { prisma } from "../lib/prisma";

const SALSAS_ID  = "cmnp2xmzp000rn60pnh56zwka";
const SERVICIO_ID = "cmnp67x1y0014mm0pemw8k02a";
const EFECTIVO_ID = "cmmc9u9li0002uuqcqr9py47j";

async function log(label: string, data: unknown) {
  console.log(`\n── ${label} ──`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  // ── 1. Verificar ingredientes especiales ─────────────────────────────────
  const [salsas, servicio] = await Promise.all([
    prisma.ingredient.findUnique({ where: { id: SALSAS_ID }, include: { product: true } }),
    prisma.ingredient.findUnique({ where: { id: SERVICIO_ID }, include: { product: true } }),
  ]);
  console.log(`\n✅ PORCION CONTABLE SALSAS — stock actual: ${salsas?.stock} porciones`);
  console.log(`✅ SERVICIO              — stock actual: ${servicio?.stock} porciones`);

  // ── 2. Buscar platillos con SALSAS/SERVICIO en receta ────────────────────
  const dishesWithSpecial = await prisma.dish.findMany({
    where: {
      enabled: true,
      recipe: { some: { ingredientId: { in: [SALSAS_ID, SERVICIO_ID] } } },
    },
    include: { recipe: { include: { ingredient: true } } },
    take: 3,
  });

  // Fallback: cualquier platillo habilitado de comida
  const fallbackDishes = await prisma.dish.findMany({
    where: { enabled: true, category: { not: "DRINK" } },
    take: 3,
  });

  const testDishes = dishesWithSpecial.length > 0 ? dishesWithSpecial : fallbackDishes;

  if (dishesWithSpecial.length === 0) {
    console.log("\n⚠️  Ningún platillo tiene SALSAS/SERVICIO en receta todavía.");
    console.log("   → El stock de esos ingredientes NO cambiará con estas ventas.");
    console.log("   → Agrega esos ingredientes en /admin/dishes para que funcione.");
  } else {
    console.log(`\n✅ Platillos con SALSAS/SERVICIO en receta: ${dishesWithSpecial.map(d => d.name).join(", ")}`);
  }

  if (testDishes.length === 0) {
    console.log("❌ No hay platillos disponibles para crear ventas de test.");
    await prisma.$disconnect();
    return;
  }

  // ── 3. Cerrar sesión abierta si la hay ───────────────────────────────────
  const openSession = await prisma.cashSession.findFirst({ where: { status: "OPEN" } });
  if (openSession) {
    await prisma.cashSession.update({
      where: { id: openSession.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    console.log(`\n🔒 Cerrada sesión abierta previa: ${openSession.id}`);
  }

  // ── 4. Abrir nueva sesión ─────────────────────────────────────────────────
  const session = await prisma.cashSession.create({
    data: { status: "OPEN", baseCash: 50000 },
  });
  console.log(`\n📂 Sesión abierta: ${session.id}`);

  // ── 5. Crear 3 ventas de test ─────────────────────────────────────────────
  const counter = await prisma.counter.upsert({
    where: { key: "ticket" },
    update: { value: { increment: 3 } },
    create: { key: "ticket", value: 3 },
  });
  let ticketNo = counter.value - 2;

  const saleIds: string[] = [];

  for (let i = 0; i < Math.min(3, testDishes.length); i++) {
    const dish = testDishes[i];
    const qty = i + 1;

    // Calcular costo desde receta
    let cost = 0;
    const fullDish = await prisma.dish.findUnique({
      where: { id: dish.id },
      include: { recipe: { include: { ingredient: { include: { batches: { where: { qtyRemaining: { gt: 0 } }, orderBy: { createdAt: "asc" } } } } } } },
    });
    if (fullDish) {
      for (const item of fullDish.recipe) {
        const needed = item.qty * qty;
        let rem = needed;
        for (const batch of item.ingredient.batches) {
          const take = Math.min(rem, batch.qtyRemaining);
          cost += take * batch.unitCost;
          rem -= take;
          if (rem <= 0) break;
        }
      }
    }

    const sale = await prisma.sale.create({
      data: {
        ticketNo: ticketNo++,
        total: dish.price * qty,
        cost: Math.round(cost),
        sessionId: session.id,
        isManagement: false,
        items: { create: [{ dishId: dish.id, qty, price: dish.price }] },
        payments: {
          create: [{ methodId: EFECTIVO_ID, amount: dish.price * qty }],
        },
      },
    });
    saleIds.push(sale.id);

    // Descontar stock (FIFO)
    if (fullDish) {
      for (const item of fullDish.recipe) {
        let rem = item.qty * qty;
        for (const batch of item.ingredient.batches) {
          if (rem <= 0) break;
          const take = Math.min(rem, batch.qtyRemaining);
          await prisma.ingredientBatch.update({
            where: { id: batch.id },
            data: { qtyRemaining: { decrement: take } },
          });
          rem -= take;
        }
        await prisma.ingredient.update({
          where: { id: item.ingredientId },
          data: { stock: { decrement: item.qty * qty } },
        });
      }
    }

    console.log(`\n🧾 Venta #${sale.ticketNo}: ${qty}x ${dish.name} = $${sale.total} (costo: $${sale.cost})`);
  }

  // ── 6. Agregar gasto de caja ──────────────────────────────────────────────
  await prisma.cashExpense.create({
    data: { sessionId: session.id, amount: 5000, description: "Gasto de caja test" },
  });
  console.log("\n💸 Gasto de caja: $5,000");

  // ── 7. Cerrar sesión ──────────────────────────────────────────────────────
  await prisma.cashSession.update({
    where: { id: session.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  console.log(`\n🔒 Sesión cerrada: ${session.id}`);

  // ── 8. Agregar gastos operativos del mes ──────────────────────────────────
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  await prisma.operatingExpense.createMany({
    data: [
      { description: "ARRIENDO", amount: 2500000, month, year },
      { description: "CELULAR",  amount: 45000,   month, year },
    ],
    skipDuplicates: false,
  });
  console.log(`\n📋 Gastos operativos agregados para ${month}/${year}: ARRIENDO $2,500,000 + CELULAR $45,000`);

  // ── 9. Verificar resultados ───────────────────────────────────────────────
  const [salasPost, servicioPost] = await Promise.all([
    prisma.ingredient.findUnique({ where: { id: SALSAS_ID } }),
    prisma.ingredient.findUnique({ where: { id: SERVICIO_ID } }),
  ]);

  const sales = await prisma.sale.findMany({
    where: { id: { in: saleIds } },
    select: { ticketNo: true, total: true, cost: true },
  });

  const totalVentas    = sales.reduce((s, x) => s + x.total, 0);
  const totalCosto     = sales.reduce((s, x) => s + x.cost, 0);
  const gastosCaja     = 5000;
  const gastosOperativos = 2500000 + 45000;
  const gananciaLibre  = totalVentas - totalCosto - gastosCaja - gastosOperativos;

  console.log("\n═══════════════════════════════════════");
  console.log("           RESUMEN DEL TEST");
  console.log("═══════════════════════════════════════");
  console.log(`Ventas:              $${totalVentas.toLocaleString("es-CO")}`);
  console.log(`Costo insumos:      -$${totalCosto.toLocaleString("es-CO")}`);
  console.log(`Gastos de caja:     -$${gastosCaja.toLocaleString("es-CO")}`);
  console.log(`Gastos operativos:  -$${gastosOperativos.toLocaleString("es-CO")}`);
  console.log(`────────────────────────────────────────`);
  console.log(`Ganancia libre:      $${gananciaLibre.toLocaleString("es-CO")}`);
  console.log(`════════════════════════════════════════`);
  console.log(`\nStock PORCION CONTABLE SALSAS: ${salasPost?.stock} porciones`);
  console.log(`Stock SERVICIO:                ${servicioPost?.stock} porciones`);

  if (dishesWithSpecial.length > 0) {
    const stoksBajaron = (salasPost?.stock ?? 0) < (salsas?.stock ?? 0) ||
                         (servicioPost?.stock ?? 0) < (servicio?.stock ?? 0);
    console.log(`\n${stoksBajaron ? "✅ Stock descontado correctamente" : "⚠️  Stock no cambió (¿recetas configuradas?)"}`);
  }

  console.log("\n✅ Abre /admin/reports → mes actual → deberías ver estos números");
  console.log("   (refresca la página si ya la tenías abierta)\n");

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
