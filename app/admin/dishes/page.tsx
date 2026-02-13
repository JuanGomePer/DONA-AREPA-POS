"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Utensils, Edit3, X } from "lucide-react";

export default function AdminDishes() {
  const [ingredients, setIngredients] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [recipe, setRecipe] = useState<{ ingredientId: string; qty: number }[]>([]);

  const loadData = async () => {
    const [resIng, resDish] = await Promise.all([
      fetch("/api/admin/inventory"),
      fetch("/api/admin/dishes")
    ]);
    setIngredients(await resIng.json());
    setDishes(await resDish.json());
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setName(""); setPrice(""); setRecipe([]); setEditingId(null);
  };

  const saveDish = async () => {
    if (!name || !price || recipe.length === 0) return alert("Datos incompletos");
    const method = editingId ? "PUT" : "POST";
    const res = await fetch("/api/admin/dishes", {
      method,
      body: JSON.stringify({ id: editingId, name, price: Number(price), recipe }),
    });
    if (res.ok) { loadData(); resetForm(); }
  };

  const deleteDish = async (id: string) => {
    if (!confirm("¿Borrar este platillo?")) return;
    await fetch(`/api/admin/dishes?id=${id}`, { method: "DELETE" });
    loadData();
  };

  const startEdit = (dish: any) => {
    setEditingId(dish.id);
    setName(dish.name);
    setPrice(dish.price.toString());
    setRecipe(dish.recipe.map((r: any) => ({ ingredientId: r.ingredientId, qty: r.qty })));
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FORMULARIO */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            {editingId ? <Edit3 className="text-amber-500" /> : <Plus className="text-blue-600" />}
            {editingId ? "Editar Platillo" : "Nuevo Platillo"}
          </h2>
          <div className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del Plato" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Precio" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500" />
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase">Receta</span>
                <button onClick={() => setRecipe([...recipe, { ingredientId: "", qty: 1 }])} className="text-blue-600 text-sm font-bold">+ Insumo</button>
              </div>
              {recipe.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select className="flex-1 p-2 bg-gray-50 rounded-xl text-sm" value={item.ingredientId} onChange={e => {
                    const nr = [...recipe]; nr[i].ingredientId = e.target.value; setRecipe(nr);
                  }}>
                    <option value="">Seleccionar...</option>
                    {ingredients.map((ing: any) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </select>
                  <input type="number" className="w-20 p-2 bg-gray-50 rounded-xl text-center text-sm" value={item.qty} onChange={e => {
                    const nr = [...recipe]; nr[i].qty = parseFloat(e.target.value); setRecipe(nr);
                  }} />
                  <button onClick={() => setRecipe(recipe.filter((_, idx) => idx !== i))} className="text-red-400 px-2"><X size={16}/></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {editingId && <button onClick={resetForm} className="flex-1 py-4 font-bold text-gray-400">CANCELAR</button>}
              <button onClick={saveDish} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase tracking-wider">
                {editingId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>

        {/* LISTADO */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <h2 className="text-xl font-black mb-6">Platillos Existentes</h2>
          <div className="space-y-4">
            {dishes.map((dish: any) => (
              <div key={dish.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-blue-50 transition-all">
                <div>
                  <p className="font-bold text-gray-800">{dish.name}</p>
                  <p className="text-blue-600 font-black text-sm">${dish.price.toLocaleString()}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => startEdit(dish)} className="p-2 text-amber-500 hover:bg-white rounded-lg shadow-sm"><Edit3 size={18}/></button>
                  <button onClick={() => deleteDish(dish.id)} className="p-2 text-red-500 hover:bg-white rounded-lg shadow-sm"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}