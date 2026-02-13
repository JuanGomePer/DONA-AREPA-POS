import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- 1) USUARIOS ---
  const users = [
    {
      email: "admin@donaarepa.local",
      pass: "Admin12345!",
      role: "ADMIN"
    },
    {
      email: "cajero@donaarepa.local",
      pass: "Cajero12345!",
      role: "CASHIER"
    }
  ];

  console.log("Creando usuarios...");
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.pass, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role }, // Actualiza el rol si ya existe
      create: { 
        email: u.email, 
        passwordHash, 
        role: u.role 
      },
    });
  }

  // --- 2) MÉTODOS DE PAGO ---
  const methods = [
    { name: "Efectivo", isCash: true, enabled: true },
    { name: "Nequi", isCash: false, enabled: true },
    { name: "Tarjeta", isCash: false, enabled: true },
    { name: "Llave", isCash: false, enabled: true },
  ];

  console.log("Configurando métodos de pago...");
  for (const m of methods) {
    await prisma.paymentMethod.upsert({
      where: { name: m.name },
      update: { enabled: m.enabled, isCash: m.isCash },
      create: m,
    });
  }

  // --- 3) DENOMINACIONES ---
  const bills = [2000, 5000, 10000, 20000, 50000, 100000];
  const coins = [50, 100, 200, 500, 1000];

  async function upsertDenom(type: "BILL" | "COIN", value: number) {
    const found = await prisma.denomination.findFirst({ where: { type, value } });
    if (found) {
      await prisma.denomination.update({ where: { id: found.id }, data: { enabled: true } });
    } else {
      await prisma.denomination.create({ data: { type, value, enabled: true } });
    }
  }

  console.log("Cargando denominaciones...");
  for (const v of bills) await upsertDenom("BILL", v);
  for (const v of coins) await upsertDenom("COIN", v);

  // --- 4) COUNTER TICKET ---
  await prisma.counter.upsert({
    where: { key: "ticket" },
    update: {},
    create: { key: "ticket", value: 0 },
  });

  // --- 5) DATOS DEMO (INGREDIENTES + PLATO) ---
  console.log("Sincronizando inventario demo...");
  const ingArepa = await prisma.ingredient.upsert({
    where: { name: "Arepa" },
    update: { stock: 100 },
    create: { name: "Arepa", unit: "unit", stock: 100 },
  });

  const ingCarne = await prisma.ingredient.upsert({
    where: { name: "Carne" },
    update: { stock: 100 },
    create: { name: "Carne", unit: "unit", stock: 100 },
  });

  const ingQueso = await prisma.ingredient.upsert({
    where: { name: "Queso" },
    update: { stock: 100 },
    create: { name: "Queso", unit: "unit", stock: 100 },
  });

  const dish = await prisma.dish.upsert({
    where: { name: "Arepa de Carne" },
    update: { price: 12000, enabled: true },
    create: { name: "Arepa de Carne", price: 12000, enabled: true },
  });

  // Receta: 1 arepa + 1 carne + 1 queso
  const recipe = [
    { ingredientId: ingArepa.id, qty: 1 },
    { ingredientId: ingCarne.id, qty: 1 },
    { ingredientId: ingQueso.id, qty: 1 },
  ];

  for (const r of recipe) {
    await prisma.recipeItem.upsert({
      where: { dishId_ingredientId: { dishId: dish.id, ingredientId: r.ingredientId } },
      update: { qty: r.qty },
      create: { dishId: dish.id, ingredientId: r.ingredientId, qty: r.qty },
    });
  }

  console.log("¡Semilla ejecutada con éxito!");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });