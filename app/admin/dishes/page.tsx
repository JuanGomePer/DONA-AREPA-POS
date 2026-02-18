"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, X, Soup, UtensilsCrossed, Coffee } from "lucide-react";

// Mapa para mostrar labels bonitos en la UI
const CATEGORY_LABEL: Record<string, string> = {
  STARTER: "Entrada",
  MAIN:    "Plato Fuerte",
  DRINK:   "Bebida",
};

export default function AdminDishes() {
  const [ingredients, setIngredients] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("MAIN"); // 👈 valor del enum, no español
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
    setName(""); 
    setPrice(""); 
    setCategory("MAIN"); // 👈
    setRecipe([]); 
    setEditingId(null);
  };

  const saveDish = async () => {
    if (!name || !price) return alert("Nombre y precio obligatorios");
    
    const method = editingId ? "PUT" : "POST";
    const body = { id: editingId, name, price: Number(price), category, recipe };

    const res = await fetch("/api/admin/dishes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) { loadData(); resetForm(); }
    else { alert("Error al guardar"); }
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
    setCategory(dish.category); // viene como "MAIN", "STARTER", etc.
    setRecipe(dish.recipe.map((r: any) => ({ ingredientId: r.ingredientId, qty: r.qty })));
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case "STARTER": return <Soup size={18} className="text-orange-500"/>;
      case "DRINK":   return <Coffee size={18} className="text-purple-500"/>;
      default:        return <UtensilsCrossed size={18} className="text-blue-500"/>;
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FORMULARIO */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 h-fit sticky top-8">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            {editingId ? <Edit3 className="text-amber-500" /> : <Plus className="text-blue-600" />}
            {editingId ? "Editar Platillo" : "Nuevo Platillo"}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2">Precio</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2">Categoría</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-bold text-gray-700"
                >
                  <option value="STARTER">Entrada</option>   {/* 👈 value = enum */}
                  <option value="MAIN">Plato Fuerte</option>
                  <option value="DRINK">Bebida</option>
                </select>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-400 uppercase">Receta (Descuenta Inventario)</span>
                <button onClick={() => setRecipe([...recipe, { ingredientId: "", qty: 1 }])} className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100">+ Insumo</button>
              </div>
              
              {recipe.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-2">No hay ingredientes vinculados.</p>
              )}

              {recipe.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select className="flex-1 p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" value={item.ingredientId} onChange={e => {
                    const nr = [...recipe]; nr[i].ingredientId = e.target.value; setRecipe(nr);
                  }}>
                    <option value="">Seleccionar ingrediente...</option>
                    {ingredients.map((ing: any) => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                  </select>
                  <input type="number" className="w-20 p-3 bg-gray-50 rounded-xl text-center text-sm outline-none focus:ring-2 focus:ring-blue-200" value={item.qty} onChange={e => {
                    const nr = [...recipe]; nr[i].qty = parseFloat(e.target.value); setRecipe(nr);
                  }} />
                  <button onClick={() => setRecipe(recipe.filter((_, idx) => idx !== i))} className="text-red-400 px-2 hover:bg-red-50 rounded-lg"><X size={16}/></button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              {editingId && <button onClick={resetForm} className="flex-1 py-4 font-bold text-gray-400 hover:bg-gray-100 rounded-2xl transition-colors">CANCELAR</button>}
              <button onClick={saveDish} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase tracking-wider">
                {editingId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>

        {/* LISTADO */}
        <div className="space-y-4">
          <h2 className="text-xl font-black mb-6 px-2">Menú Actual</h2>
          {dishes.map((dish: any) => (
            <div key={dish.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                  {getCategoryIcon(dish.category)}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{dish.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-black text-sm">${dish.price.toLocaleString()}</span>
                    {/* 👈 Usamos el mapa para mostrar el label bonito */}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                      {CATEGORY_LABEL[dish.category] ?? dish.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => startEdit(dish)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"><Edit3 size={20}/></button>
                <button onClick={() => deleteDish(dish.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={20}/></button>
              </div>
            </div>
          ))}
          
          {dishes.length === 0 && (
            <div className="text-center p-12 text-gray-300">
              <UtensilsCrossed size={48} className="mx-auto mb-4 opacity-50"/>
              <p>No hay platillos creados aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}