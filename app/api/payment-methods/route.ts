import { NextRequest, NextResponse } from "next/server"; // Asegúrate de usar NextRequest
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

export async function GET(req: NextRequest) {  // Cambiar Request a NextRequest
  const { error } = await requireSession(req);  // Pasamos req a requireSession
  if (error) return error;

  const methods = await prisma.paymentMethod.findMany({
    where: { enabled: true },
    orderBy: [{ isCash: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(methods);
}
