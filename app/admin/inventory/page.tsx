"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, X, Check } from "lucide-react";

export default function AdminInventory() {
  const [ingredients, setIngredients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIng, setEditingIng] = useState<any>(null);
  const [form, setForm] = useState({ name: "", unit: "unit", stock: "" });

  const loadData = () => fetch("/api/admin/inventory").then(res => res.json()).then(setIngredients);
  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingIng ? "PUT" : "POST";
    const body = editingIng ? { ...form, id: editingIng.id } : form;
    
    const res = await fetch("/api/admin/inventory", {
      method,
      body: JSON.stringify(body),
    });
    if (res.ok) { 
      setShowModal(false); setEditingIng(null); setForm({ name: "", unit: "unit", stock: "" }); 
      loadData(); 
    }
  };

  const deleteIng = async (id: string) => {
    if (!confirm("¿Borrar ingrediente? Esto afectará las recetas que lo usen.")) return;
    await fetch(`/api/admin/inventory?id=${id}`, { method: "DELETE" });
    loadData();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Control de Stock</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
          <Plus size={20} /> NUEVO INSUMO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {ingredients.map((ing: any) => (
          <div key={ing.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                <Edit3 size={20} className="cursor-pointer" onClick={() => {
                  setEditingIng(ing);
                  setForm({ name: ing.name, unit: ing.unit, stock: ing.stock.toString() });
                  setShowModal(true);
                }}/>
              </div>
              <button onClick={() => deleteIng(ing.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={18} />
              </button>
            </div>
            <p className="text-gray-400 text-xs font-black uppercase mb-1 tracking-widest">{ing.name}</p>
            <div className="flex justify-between items-end">
              <span className={`text-3xl font-black ${ing.stock < 10 ? 'text-red-500' : 'text-gray-900'}`}>{ing.stock}</span>
              <span className="text-gray-400 font-bold mb-1">{ing.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black mb-6">{editingIng ? "Editar Insumo" : "Nuevo Insumo"}</h2>
            <div className="space-y-4">
              <input placeholder="Nombre" className="w-full p-4 bg-gray-50 rounded-2xl border-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <select className="w-full p-4 bg-gray-50 rounded-2xl border-none" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                <option value="unit">Unidad</option>
                <option value="gr">Gramos</option>
                <option value="ml">Mililitros</option>
              </select>
              <input type="number" placeholder="Cantidad de Stock" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-xl text-blue-600" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => { setShowModal(false); setEditingIng(null); }} className="flex-1 font-bold text-gray-400 uppercase tracking-widest text-sm">Cerrar</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">GUARDAR</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}