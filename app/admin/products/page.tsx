"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, ChevronDown, ChevronUp } from "lucide-react";

type IngredientProduct = {
  id: string;
  ingredientId: string;
  packPrice: number;
  packQty: number;
};

type IngredientBatch = {
  id: string;
  ingredientId: string;
  qtyRemaining: number;
  unitCost: number;
  createdAt: string; // viene como ISO
};

type IngredientRow = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  product: IngredientProduct | null;
  batches: IngredientBatch[];
};

function money(n: number) {
  try {
    return Math.round(n).toLocaleString("es-CO");
  } catch {
    return String(n);
  }
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CO", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function AdminProductsPage() {
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { packPrice: string; packQty: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});

  async function load() {
    setErr(null);
    const res = await fetch("/api/admin/products");
    const data = await res.json();
    if (!res.ok) {
      setErr(data?.error || "Error cargando productos");
      return;
    }

    setRows(data);

    const nextDraft: typeof draft = {};
    const nextOpen: typeof openBatches = {};
    for (const r of data as IngredientRow[]) {
      nextDraft[r.id] = {
        packPrice: r.product ? String(r.product.packPrice) : "",
        packQty: r.product ? String(r.product.packQty) : "",
      };
      nextOpen[r.id] = openBatches[r.id] ?? false;
    }
    setDraft(nextDraft);
    setOpenBatches(nextOpen);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(() => {
    return rows.map((r) => {
      const d = draft[r.id] || { packPrice: "", packQty: "" };
      const price = parseInt(d.packPrice || "0", 10);
      const qty = parseFloat(d.packQty || "0");
      const unitCost = qty > 0 ? price / qty : 0;
      return { ...r, price, qty, unitCost };
    });
  }, [rows, draft]);

  async function save(ingredientId: string) {
    setErr(null);
    const d = draft[ingredientId];
    if (!d) return;

    const packPrice = parseInt(d.packPrice || "", 10);
    const packQty = parseFloat(d.packQty || "");

    if (!Number.isFinite(packPrice) || packPrice < 0 || !Number.isFinite(packQty) || packQty <= 0) {
      setErr("Revisa: packPrice (>=0) y packQty (>0).");
      return;
    }

    setSavingId(ingredientId);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId, packPrice, packQty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "Error guardando");
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black">Productos (Costos)</h1>
        </div>

        <button
          onClick={load}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-2xl font-black"
        >
          Refrescar
        </button>
      </div>

      {err && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 font-bold">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {computed.map((r) => (
          <div key={r.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{r.name}</p>
                <p className="text-sm text-gray-500 font-bold">
                  Unidad: <span className="text-gray-700">{r.unit}</span> • Stock:{" "}
                  <span className="text-gray-700">{r.stock % 1 === 0 ? r.stock : r.stock.toFixed(2)}</span>
                </p>
              </div>

              <button
                onClick={() => save(r.id)}
                disabled={savingId === r.id}
                className="bg-blue-600 text-white px-4 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} />
                {savingId === r.id ? "Guardando..." : "Guardar"}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">
                  Valor del paquete (COP)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl text-gray-800"
                  value={draft[r.id]?.packPrice ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [r.id]: { ...(prev[r.id] || { packPrice: "", packQty: "" }), packPrice: e.target.value },
                    }))
                  }
                  placeholder="Ej: 50000"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">
                  Porciones / cantidad que rinde ({r.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl text-gray-800"
                  value={draft[r.id]?.packQty ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [r.id]: { ...(prev[r.id] || { packPrice: "", packQty: "" }), packQty: e.target.value },
                    }))
                  }
                  placeholder={`Ej: 10 (${r.unit})`}
                />
              </div>
            </div>

            <div className="mt-5 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Costo unitario actual</div>
              <div className="text-2xl font-black text-blue-700">
                {r.qty > 0 ? `${money(r.unitCost)} COP / ${r.unit}` : "—"}
              </div>
            </div>

            {/* LOTES */}
            <div className="mt-5">
              <button
                onClick={() => setOpenBatches((p) => ({ ...p, [r.id]: !p[r.id] }))}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl font-black text-gray-700"
              >
                <span>Ver lotes (últimos 10)</span>
                {openBatches[r.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {openBatches[r.id] && (
                <div className="mt-3 p-4 rounded-2xl border border-gray-100">
                  {r.batches.length === 0 ? (
                    <p className="text-sm text-gray-500 font-bold">
                      No hay lotes todavía. Para crear lotes, usa “Agregar” en Inventario (reabastecer).
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {r.batches.map((b) => {
                        const totalRemaining = b.qtyRemaining * b.unitCost;
                        return (
                          <div key={b.id} className="flex items-center justify-between gap-3 bg-white">
                            <div>
                              <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                {fmtDate(b.createdAt)}
                              </div>
                              <div className="text-sm font-bold text-gray-700">
                                Queda:{" "}
                                <span className="text-gray-900">
                                  {b.qtyRemaining % 1 === 0 ? b.qtyRemaining : b.qtyRemaining.toFixed(2)}
                                </span>{" "}
                                {r.unit}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-black text-gray-900">
                                {money(b.unitCost)} COP/{r.unit}
                              </div>
                              <div className="text-xs font-bold text-gray-500">
                                Valor restante: {money(totalRemaining)} COP
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-400 font-bold pt-2">
                        Tip: Cambia el precio arriba, guarda, luego reabastece en Inventario → verás un lote nuevo con otro costo.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
