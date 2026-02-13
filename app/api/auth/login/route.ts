import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/getSession"; // Usa la función que ya definimos
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    // --- LA MEJORA AQUÍ ---
    const session = await getSession();
    session.userId = user.id;
    session.role = user.role as any;
    await session.save();

    // Devolvemos el rol para que el cliente sepa a dónde saltar
    return NextResponse.json({ 
      ok: true, 
      role: user.role 
    });
  } catch (error) {
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}