import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Limpiar usuarios existentes (opcional, comenta si no quieres borrar)
  // await prisma.user.deleteMany();

  // Crear usuario Admin
  const adminPassword = await bcrypt.hash("Carlos79756051", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin" },
    update: {},
    create: {
      email: "admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("✅ Usuario Admin creado:", admin.email);

  // Crear usuario Cajero
  const cashierPassword = await bcrypt.hash("cajero2026", 10);
  const cashier = await prisma.user.upsert({
    where: { email: "cajero" },
    update: {},
    create: {
      email: "cajero",
      passwordHash: cashierPassword,
      role: "CASHIER",
    },
  });
  console.log("✅ Usuario Cajero creado:", cashier.email);

  // Crear métodos de pago básicos
  const metodosExistentes = await prisma.paymentMethod.count();
  if (metodosExistentes === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        { name: "Efectivo", isCash: true, enabled: true },
        { name: "Tarjeta", isCash: false, enabled: true },
        { name: "Transferencia", isCash: false, enabled: true },
      ],
    });
    console.log("✅ Métodos de pago creados");
  }

  console.log("🎉 Seed completado!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });