import { NextRequest, NextResponse } from "next/server"; // Asegúrate de usar NextRequest
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);  // Pasamos req como argumento
  if (error) return error;

  if (session!.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo ADMIN puede crear usuarios" }, { status: 403 });
  }

  const { email, password, role } = await req.json();
  const normalizedEmail = String(email || "").toLowerCase();
  const pass = String(password || "");

  if (!normalizedEmail || pass.length < 8) {
    return NextResponse.json({ error: "Email y contraseña (mín 8) requeridos" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return NextResponse.json({ error: "Ese email ya existe" }, { status: 409 });

  const passwordHash = await bcrypt.hash(pass, 12);
  await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, role: role === "ADMIN" ? "ADMIN" : "CASHIER" },
  });

  return NextResponse.json({ ok: true });
}
