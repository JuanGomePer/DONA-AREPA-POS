"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  UtensilsCrossed,
  ShoppingBag,
  LogOut,
  TrendingUp,
  ShoppingBag as PosIcon,
  Boxes,
} from "lucide-react";

const menuItems = [
  { name: "Insumos", href: "/admin/inventory", icon: Package },

  // ✅ NUEVO: Productos (contable) justo debajo de inventario
  { name: "Productos", href: "/admin/products", icon: Boxes },

  { name: "Platillos", href: "/admin/dishes", icon: UtensilsCrossed },
  { name: "Ventas Reales", href: "/admin/sales", icon: ShoppingBag },
  { name: "Reportes Contables", href: "/admin/reports", icon: TrendingUp },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (confirm("¿Cerrar sesión administrativa?")) {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    }
  };

  return (
    <aside className="w-64 bg-white h-screen border-r border-gray-100 flex flex-col fixed left-0 top-0">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-xl text-white font-black text-xs">DA</div>
          <span className="font-black text-xl tracking-tight text-gray-900">AdminPanel</span>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
                pathname === item.href
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 space-y-2">
        <Link
          href="/pos"
          className="flex items-center gap-3 px-4 py-3 w-full text-green-600 font-bold hover:bg-green-50 rounded-2xl transition-all"
        >
          <PosIcon size={20} />
          Ir al POS
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-red-400 font-bold hover:bg-red-50 rounded-2xl transition-all"
        >
          <LogOut size={20} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
