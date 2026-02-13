import { cookies } from "next/headers";  // Usa cookies() desde next/headers
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./session";

// La función getSession() ahora debe ser asíncrona
export async function getSession() {
  const cookieStore = await cookies();  // Usamos `await` para obtener las cookies correctamente
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);  // Ahora pasamos el valor resuelto
  return session;
}
