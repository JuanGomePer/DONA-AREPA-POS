"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, X, PlusCircle } from "lucide-react";

type ModalMode = "edit" | "restock";

type IngredientProduct = {
  packPrice: number;
  packQty: number;
};

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  product?: IngredientProduct | null;
};

function unitCost(ing: Ingredient) {
  if (!ing.product) return null;
  if (!ing.product.packQty || ing.product.packQty <= 0) return null;
  return ing.product.packPrice / ing.product.packQty;
}

export default function AdminInventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("edit");
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  const [form, setForm] = useState({ name: "", unit: "unit", stock: "" });
  const [restockAmount, setRestockAmount] = useState("");

  const loadData = () =>
    fetch("/api/admin/inventory")
      .then((res) => res.json())
      .then(setIngredients)
      .catch(err => console.error("Error loading inventory:", err));

  useEffect(() => {
    loadData();
  }, []);

  const openEditModal = (ing: Ingredient) => {
    setModalMode("edit");
    setEditingIng(ing);
    setForm({ name: ing.name, unit: ing.unit, stock: ing.stock.toString() });
    setShowModal(true);
  };

  const openRestockModal = (ing: Ingredient) => {
    setModalMode("restock");
    setEditingIng(ing);
    setRestockAmount("");
    setShowModal(true);
  };

  const openCreateModal = () => {
    setModalMode("edit");
    setEditingIng(null);
    setForm({ name: "", unit: "unit", stock: "" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIng(null);
    setRestockAmount("");
    setForm({ name: "", unit: "unit", stock: "" });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingIng ? "PUT" : "POST";
    const body = editingIng ? { ...form, id: editingIng.id } : form;

    try {
      const res = await fetch("/api/admin/inventory", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        closeModal();
        loadData();
      } else {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        alert(data.error || "Error al guardar");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión");
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng) return;

    const amt = parseFloat(restockAmount);
    if (!restockAmount || !Number.isFinite(amt) || amt <= 0) {
      alert("Por favor ingresa una cantidad válida");
      return;
    }

    if (!unitCost(editingIng)) {
      alert("Configura el producto (precio y porciones) antes de reabastecer");
      return;
    }

    try {
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingIng.id, amount: restockAmount }),
      });

      if (res.ok) {
        closeModal();
        loadData();
      } else {
        let errorMsg = "Error al agregar stock";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch (jsonError) {
          errorMsg = `Error ${res.status}: ${res.statusText}`;
        }
        alert(errorMsg);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión al agregar stock");
    }
  };

  const deleteIng = async (id: string) => {
    if (!confirm("¿Borrar ingrediente? Esto afectará las recetas que lo usen.")) return;
    
    try {
      const res = await fetch(`/api/admin/inventory?id=${id}`, { method: "DELETE" });
      
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        alert(data.error || "Error al eliminar ingrediente");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión");
    }
  };

  const getStockColor = (stock: number) => {
    if (stock <= 0) return "text-red-500";
    if (stock <= 5) return "text-amber-500";
    return "text-gray-900";
  };

  const formatStock = (stock: number | undefined) => {
    if (stock === undefined || stock === null) return "0";
    return stock % 1 === 0 ? stock : stock.toFixed(2);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Control de Stock</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} /> NUEVO INSUMO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {ingredients.map((ing) => {
          const uc = unitCost(ing);
          return (
            <div
              key={ing.id}
              className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative flex flex-col justify-between"
            >
              <button
                onClick={() => deleteIng(ing.id)}
                className="absolute top-4 right-4 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>

              <div className="mb-5">
                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2">{ing.name}</p>

                <div className="flex items-end justify-between">
                  <span className={`text-4xl font-black ${getStockColor(ing.stock ?? 0)}`}>
                    {formatStock(ing.stock)}
                  </span>
                  <span className="text-gray-400 font-bold mb-1">{ing.unit}</span>
                </div>

                <div className="mt-3 text-xs font-bold text-gray-500">
                  {uc ? (
                    <span>
                      Costo actual: <span className="text-blue-700">{uc.toFixed(2)} COP</span> / {ing.unit}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Sin costo configurado (ve a <b>/admin/products</b>)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(ing)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold text-xs transition-colors"
                >
                  <Edit3 size={14} /> Corregir
                </button>

                <button
                  onClick={() => openRestockModal(ing)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold text-xs transition-colors"
                >
                  <PlusCircle size={14} /> Agregar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-[40px] w-full max-w-md shadow-2xl">
            {modalMode === "edit" && (
              <form onSubmit={handleEditSubmit}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black">{editingIng ? "Corregir Insumo" : "Nuevo Insumo"}</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                {editingIng && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold">
                    ⚠️ Esto reemplaza el stock actual. Usa "Agregar" para sumar existencias.
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">Nombre</label>
                    <input
                      placeholder="Ej: Harina de maíz"
                      className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">Unidad</label>
                    <select
                      className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    >
                      <option value="unit">Unidad</option>
                      <option value="gr">Gramos</option>
                      <option value="ml">Mililitros</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">
                      Stock {editingIng ? "(valor exacto)" : "inicial"}
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      step="any"
                      className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-xl text-blue-600"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 font-bold text-gray-400 uppercase tracking-widest text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700"
                  >
                    GUARDAR
                  </button>
                </div>
              </form>
            )}

            {modalMode === "restock" && editingIng && (
              <form onSubmit={handleRestockSubmit}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black">Agregar Stock</h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-6 p-5 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">{editingIng.name}</p>
                  <div className="flex items-end gap-2">
                    <span className="text-gray-500 font-bold text-sm">Stock actual:</span>
                    <span className="text-2xl font-black text-blue-700">
                      {formatStock(editingIng.stock)} {editingIng.unit}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-bold text-gray-600">
                    {unitCost(editingIng) ? (
                      <>
                        Costo actual:{" "}
                        <span className="text-blue-700">{unitCost(editingIng)!.toFixed(2)} COP</span> / {editingIng.unit}
                      </>
                    ) : (
                      <span className="text-amber-700">
                        Falta configurar costo en <b>/admin/products</b>
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">
                    Cantidad a agregar ({editingIng.unit})
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0.01"
                    step="any"
                    autoFocus
                    className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-black text-3xl text-blue-600 text-center"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 font-bold text-gray-400 uppercase tracking-widest text-sm"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={!unitCost(editingIng)}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    + AGREGAR
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}