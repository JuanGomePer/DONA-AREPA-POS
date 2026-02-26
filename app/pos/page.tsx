import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/getSession";
import PosClient from "./pos-client";

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await getSession();
  
  if (!session?.userId) {
    redirect('/login');
  }

  // 👇 Pre-verificar si hay sesión activa (ANTES de cargar el cliente)
  const activeSession = await prisma.cashSession.findFirst({
    where: { status: "OPEN" },
    select: { id: true }
  });

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

  return (
    <PosClient 
      dishes={dishes} 
      methods={methods} 
      denoms={denoms}
      hasActiveSession={!!activeSession}  // 👈 Pasar estado inicial
    />
  );
}