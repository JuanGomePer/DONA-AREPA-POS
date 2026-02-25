import { prisma } from "@/lib/prisma";
import PosClient from "./pos-client";

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  // Middleware ya se encarga de redirigir si no hay cookie.
  const [dishes, methods, denoms] = await Promise.all([
    prisma.dish.findMany({ where: { enabled: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      where: { enabled: true },
      orderBy: [{ isCash: "desc" }, { name: "asc" }],
    }),
    prisma.denomination.findMany({
      where: { enabled: true },
      orderBy: [{ type: "asc" }, { value: "asc" }],
    }),
  ]);

  return <PosClient dishes={dishes} methods={methods} denoms={denoms} />;
}