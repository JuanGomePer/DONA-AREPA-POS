// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Si alguien entra a la raíz, el middleware lo mandará al login o al pos
  // según si tiene sesión o no.
  redirect("/pos");
}