"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErr(data.error || "Error");
      return;
    }

    // --- LA LÓGICA DE REDIRECCIÓN AQUÍ ---
    // Usamos window.location.href para asegurar que el middleware 
    // atrape la sesión limpia al cargar la nueva ruta
    if (data.role === "ADMIN") {
      window.location.href = "/admin/inventory";
    } else {
      window.location.href = "/pos";
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-gray-900">Doña Arepa</h1>
          <p className="text-gray-500 text-sm">Sistema de Gestión</p>
        </div>

        <div className="space-y-2">
          <input
            className="w-full border-none bg-gray-100 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border-none bg-gray-100 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {err && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">
            {err}
          </div>
        )}

        <button 
          className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200" 
          type="submit"
        >
          Entrar al sistema
        </button>
      </form>
    </div>
  );
}