import { NextRequest, NextResponse  } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./session";

// Cambiar a una función asíncrona porque `cookies()` devuelve una promesa
export async function requireSession(req: NextRequest) {
  const res = NextResponse.next(); // Creamos una respuesta mutable para guardar las cookies
  const session = await getIronSession<SessionData>(req, res, sessionOptions); // Usamos await

  if (!session.userId) {
    return { session: null, error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  return { session, error: null }; // Retorna la sesión si está autenticado
}
