import { NextResponse } from "next/server";
import { getSession } from "@/lib/getSession";

export async function POST() {
  try {
    const session = await getSession();
    session.destroy(); // Borra la cookie del navegador
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo cerrar sesión" }, { status: 500 });
  }
}