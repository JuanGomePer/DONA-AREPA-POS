"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Minus, ShoppingCart, Trash2, Banknote, CreditCard,
  LogOut, Calculator, X, Receipt, Lock, PlayCircle, MapPin, FileText,
  Coffee, UtensilsCrossed, Soup, Delete, Package, MinusCircle, Printer, Crown, TrendingUp
} from "lucide-react";

type Dish = { id: string; name: string; price: number; enabled: boolean; category: "STARTER" | "MAIN" | "DRINK" };
type PaymentMethod = { id: string; name: string; enabled: boolean; isCash: boolean };
type Denomination = { id: string; type: string; value: number; enabled: boolean };
type Ingredient = { id: string; name: string; unit: string; stock: number };
type Expense = { id: string; amount: number; description: string; createdAt: string };

type ManagementOrderItem = { id: string; qty: number; price: number; dishName: string };
type ManagementOrder = { id: string; ticketNo: number; total: number; createdAt: string; items: ManagementOrderItem[] };

type Report = {
  id: string;
  openedAt: string;
  baseCash: number;
  totalSold: number;
  count: number;
  byMethod: Record<string, { name: string; amount: number; isCash: boolean }>;
  expenses: Expense[];
  totalExpenses: number;
  managementOrders: ManagementOrder[];
  managementCount: number;
};

export default function PosClient({
  dishes = [],
  methods = [],
}: {
  dishes?: Dish[];
  methods?: PaymentMethod[];
  denoms?: Denomination[];
}) {
  const r = useRouter();

  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"STARTER" | "MAIN" | "DRINK">("MAIN");
  const [methodId, setMethodId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCashReport, setShowCashReport] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Apertura de caja
  const [baseCashInput, setBaseCashInput] = useState("");

  // Pago
  const [cashInput, setCashInput] = useState("");
  const [locator, setLocator] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [isManagement, setIsManagement] = useState(false);

  // Inventario
  const [inventory, setInventory] = useState<Ingredient[]>([]);

  // Gasto (solo monto)
  const [expenseAmount, setExpenseAmount] = useState("");

  useEffect(() => {
    setMounted(true);
    fetchReport();
    if (methods.length > 0 && !methodId) setMethodId(methods[0].id);
  }, [methods, methodId]);

  const selectedMethod = methods.find((m) => m.id === methodId);
  const formatCurrency = (val: number) => `$${val.toLocaleString("es-CO")}`;

  const filteredDishes = useMemo(() => dishes.filter((d) => d.category === activeTab), [dishes, activeTab]);

  const cartItems = useMemo(() => {
    const map = new Map(dishes.map((d) => [d.id, d]));
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([dishId, qty]) => ({
        dishId, qty,
        dish: map.get(dishId)!,
        line: (map.get(dishId)?.price || 0) * qty,
      }));
  }, [cart, dishes]);

  const total = useMemo(() => cartItems.reduce((acc, it) => acc + it.line, 0), [cartItems]);

  // ─── Fetches ─────────────────────────────────────────────────
  const fetchReport = async () => {
    try {
      const res = await fetch("/api/cash-report");
      const data = await res.json();
      if (data.session) { setReport(data.session); setSessionActive(true); }
      else { setSessionActive(false); }
    } catch (e) { console.error(e); }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/admin/inventory");
      setInventory(await res.json());
    } catch (e) { console.error(e); }
  };

  // ─── Sesión ───────────────────────────────────────────────────
  const handleOpenSession = async () => {
    setLoading(true);
    try {
      await fetch("/api/cash-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "OPEN", baseCash: parseInt(baseCashInput) || 0 }),
      });
      await fetchReport();
      setShowOpenModal(false);
      setBaseCashInput("");
    } finally { setLoading(false); }
  };

  const handleCloseSession = async () => {
    if (!confirm("¿Deseas finalizar la jornada y cerrar sesión?")) return;
    setLoading(true);
    try {
      await fetch("/api/cash-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE" }),
      });
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) { console.error(e); }
    finally { setLoading(false); window.location.href = "/login"; }
  };

  // ─── Gasto (solo monto) ───────────────────────────────────────
  const handleAddExpense = async () => {
    if (!expenseAmount) return;

    const res = await fetch("/api/cash-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_EXPENSE", amount: expenseAmount }),
    });

    if (res.ok) {
      setExpenseAmount("");
      setShowExpenseModal(false);
      fetchReport();
    }
  };

  // ─── Carrito ──────────────────────────────────────────────────
  const addDish = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const subDish = (id: string) => setCart((c) => {
    const next = { ...c };
    if (next[id] > 1) next[id] -= 1; else delete next[id];
    return next;
  });

  const handleNumpadClick = (val: string) => setCashInput((prev) => prev + val);
  const clearNumpad = () => setCashInput("");
  const backspaceNumpad = () => setCashInput((prev) => prev.slice(0, -1));

  // ─── Pago ─────────────────────────────────────────────────────
  async function pay() {
    setErr(null);
    if (!locator.trim()) { setErr("Por favor asigna un localizador."); return; }

    if (!isManagement) {
      const cashReceived = selectedMethod?.isCash ? Number(cashInput) : null;
      if (selectedMethod?.isCash && (!cashReceived || cashReceived < total)) {
        setErr("Efectivo insuficiente."); return;
      }
    }

    setLoading(true);
    try {
      const body: any = {
        items: cartItems.map((it) => ({ dishId: it.dishId, qty: it.qty })),
        locator,
        note: orderNote,
        isManagement,
      };
      if (!isManagement) {
        body.payment = {
          methodId,
          cashReceived: selectedMethod?.isCash ? Number(cashInput) : null,
        };
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en venta");

      const params = new URLSearchParams({
        loc: locator,
        note: orderNote,
        ...(isManagement && { management: "1" }),
      });
      r.push(`/receipt/${data.saleId}?${params.toString()}`);
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  // ─── Imprimir ─────────────────────────────────────────────────
  const printReport = () => {
    if (!report) return;

    const methodsList = Object.values(report.byMethod || {});
    const cashSales = methodsList.filter((m) => m.isCash).reduce((acc, m) => acc + m.amount, 0);
    const otherMethods = methodsList.filter((m) => !m.isCash);
    const gasto = report.totalExpenses;

    const efectivoNeto = cashSales - gasto;
    const totalCheck = efectivoNeto + otherMethods.reduce((a, m) => a + m.amount, 0) + gasto;

    const html = `<!DOCTYPE html><html><head><title>Cierre de Turno</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Courier New',monospace; font-size:13px; padding:20px; max-width:380px; }
      h1 { text-align:center; font-size:18px; margin-bottom:2px; }
      .sub { text-align:center; font-size:11px; margin-bottom:10px; color:#555; }
      .row { display:flex; justify-content:space-between; padding:3px 0; gap:10px; }
      .bold { font-weight:bold; }
      .indent { padding-left:14px; color:#444; }
      .divider { border-top:1px dashed #000; margin:8px 0; }
      .section { font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#777; margin:6px 0 3px; }
      .total { font-size:16px; font-weight:bold; }
      .footer { text-align:center; font-size:10px; color:#888; margin-top:10px; }
    </style></head><body>
      <h1>DONA AREPA</h1>
      <p class="sub">PUNTO DE VENTA — CIERRE</p>

      <div class="divider"></div>
      <div class="row"><span>Apertura:</span><span>${new Date(report.openedAt).toLocaleString("es-CO")}</span></div>
      <div class="row"><span>Corte:</span><span>${new Date().toLocaleString("es-CO")}</span></div>

      <div class="divider"></div>
      <p class="section">Base</p>
      <div class="row bold"><span>Base (no se suma)</span><span>${formatCurrency(report.baseCash)}</span></div>

      <div class="divider"></div>
      <p class="section">Ventas</p>
      <div class="row bold"><span>Ventas (total)</span><span>${formatCurrency(report.totalSold)}</span></div>

      <div class="row indent"><span>Efectivo</span><span>${formatCurrency(efectivoNeto)}</span></div>
      ${otherMethods.map(m => `
        <div class="row indent"><span>${m.name}</span><span>${formatCurrency(m.amount)}</span></div>
      `).join("")}
      <div class="row indent"><span>Gasto</span><span>${formatCurrency(gasto)}</span></div>

      <div class="row total"><span>Total</span><span>${formatCurrency(totalCheck)}</span></div>

      <div class="divider"></div>
      ${report.managementCount > 0 ? `
        <p class="section">Gerencia (${report.managementCount})</p>
        ${report.managementOrders.map((o: any) => `
          <div class="row bold"><span>${new Date(o.createdAt).toLocaleString("es-CO")}</span><span>${formatCurrency(o.total)}</span></div>
          ${(o.items || []).map((it: any) => `
            <div class="row indent">
              <span>${it.qty}x ${it.dishName}</span>
              <span>${formatCurrency(it.qty * it.price)}</span>
            </div>
          `).join("")}
          <div class="divider"></div>
        `).join("")}
      ` : ""}

      <p class="footer">Generado: ${new Date().toLocaleString("es-CO")}</p>
    </body></html>`;

    const w = window.open("", "_blank", "width=420,height=650");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  // ─── Helpers ──────────────────────────────────────────────────
  const getStockColor = (stock: number) => {
    if (stock <= 0) return "text-red-600 bg-red-50";
    if (stock <= 5) return "text-amber-600 bg-amber-50";
    return "text-green-600 bg-green-50";
  };

  if (!mounted) return null;

  // ─── CAJA CERRADA ─────────────────────────────────────────────
  if (!sessionActive) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-12 rounded-[50px] shadow-2xl text-center border max-w-sm w-full">
          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter">CAJA CERRADA</h1>
          <p className="text-gray-500 mb-8 font-medium">Inicia un turno para comenzar a vender.</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            <PlayCircle /> ABRIR TURNO
          </button>
        </div>

        {showOpenModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl">
              <h2 className="text-2xl font-black mb-1">Abrir Turno</h2>
              <p className="text-gray-400 text-sm mb-6">¿Con cuánto dinero base abre la caja hoy?</p>
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-2 block">Monto base ($)</label>
              <input
                type="number" placeholder="0" autoFocus
                value={baseCashInput}
                onChange={e => setBaseCashInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleOpenSession()}
                className="w-full p-5 bg-gray-50 rounded-2xl font-black text-3xl text-blue-600 text-center outline-none focus:ring-2 focus:ring-blue-400 mb-8"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowOpenModal(false)} className="flex-1 py-4 font-bold text-gray-400 hover:bg-gray-50 rounded-2xl">
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  onClick={handleOpenSession}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg"
                >
                  {loading ? "ABRIENDO..." : "CONFIRMAR"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── POS PRINCIPAL ────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden font-sans text-gray-900">

      {/* HEADER */}
      
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white font-black">DA</div>
          <h1 className="font-bold text-xl tracking-tight hidden md:block">Dona Arepa POS</h1>
        </div>
        <div className="flex items-center gap-2">

          <button
      onClick={() => r.push("/admin/inventory")}
      className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-bold hover:bg-purple-100 transition-colors border border-purple-200"
    >
      <TrendingUp size={20} /><span className="hidden sm:inline">Admin</span>
    </button>
          
          <button
            onClick={() => { fetchInventory(); setShowInventory(true); }}
            className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold hover:bg-green-100 transition-colors border border-green-200"
          >
            <Package size={20} /><span className="hidden sm:inline">Inventario</span>
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors border border-red-200"
          >
            <MinusCircle size={20} /><span className="hidden sm:inline">Gasto</span>
          </button>

          <button
            onClick={() => { fetchReport(); setShowCashReport(true); }}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Calculator size={20} /><span className="hidden sm:inline">Caja</span>
          </button>

          <button
            disabled={loading}
            onClick={handleCloseSession}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* PRODUCTOS */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex p-1 bg-gray-200 rounded-2xl">
              {([
                { key: "STARTER", label: "ENTRADAS", icon: <Soup size={20} />, active: "text-orange-500" },
                { key: "MAIN", label: "FUERTES", icon: <UtensilsCrossed size={20} />, active: "text-blue-600" },
                { key: "DRINK", label: "BEBIDAS", icon: <Coffee size={20} />, active: "text-purple-600" },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${activeTab === tab.key ? `bg-white ${tab.active} shadow-md` : "text-gray-500 hover:bg-gray-300/50"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {filteredDishes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p className="font-bold text-lg">No hay productos en esta categoría</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDishes.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => addDish(d.id)}
                    className="bg-white p-4 rounded-3xl shadow-sm border-2 border-transparent active:border-blue-500 active:scale-95 transition-all flex flex-col items-center text-center justify-between min-h-[140px] hover:shadow-md"
                  >
                    <span className="font-bold text-gray-800 text-lg leading-tight line-clamp-2">{d.name}</span>
                    <span className="text-blue-600 font-black text-xl mt-2">{formatCurrency(d.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ORDEN */}
        <div className="w-full md:w-[400px] bg-white shadow-2xl flex flex-col h-full border-l z-20">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h2 className="font-black text-xl uppercase tracking-tighter flex items-center gap-2">
              <Receipt size={24} className="text-blue-600" /> Orden
            </h2>
            <button onClick={() => setCart({})} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                <ShoppingCart size={80} strokeWidth={1} />
                <p className="font-medium mt-4 italic text-lg">Esperando pedido...</p>
              </div>
            ) : cartItems.map((it) => (
              <div key={it.dishId} className="flex items-center justify-between p-4 bg-white border rounded-2xl shadow-sm">
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-sm">{it.dish.name}</div>
                  <div className="text-blue-600 font-medium text-xs">{formatCurrency(it.dish.price)}</div>
                </div>
                <div className="flex items-center gap-3 bg-gray-100 p-1 rounded-xl">
                  <button onClick={() => subDish(it.dishId)} className="bg-white shadow-sm p-1 rounded-lg active:scale-90"><Minus size={14} /></button>
                  <span className="font-black text-base w-4 text-center">{it.qty}</span>
                  <button onClick={() => addDish(it.dishId)} className="bg-white shadow-sm p-1 rounded-lg active:scale-90"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 border-t bg-gray-50 space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-gray-500 font-bold uppercase text-xs">Total</span>
              <span className="text-4xl font-black text-gray-900 leading-none">{formatCurrency(total)}</span>
            </div>
            <button
              disabled={cartItems.length === 0}
              onClick={() => { setCashInput(""); setLocator(""); setOrderNote(""); setIsManagement(false); setShowPaymentModal(true); }}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white py-5 rounded-2xl text-2xl font-black transition-all shadow-lg active:scale-95"
            >
              COBRAR
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL INVENTARIO ───────────────────────────────────── */}
      {showInventory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center"><Package size={24} /></div>
                <div>
                  <h3 className="text-2xl font-black">Inventario</h3>
                  <p className="text-gray-400 text-sm font-medium">{inventory.length} insumos</p>
                </div>
              </div>
              <button onClick={() => setShowInventory(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>
            <div className="px-8 pb-4 flex gap-4 shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Normal</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Bajo (≤5)</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Agotado</span>
            </div>
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
              {inventory.length === 0 ? (
                <div className="text-center py-12 text-gray-300">
                  <Package size={48} className="mx-auto mb-3 opacity-50" />
                  <p>Sin insumos registrados</p>
                </div>
              ) : inventory.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="font-bold text-gray-800">{ing.name}</span>
                  <span className={`font-black text-sm px-3 py-1 rounded-xl ${getStockColor(ing.stock)}`}>
                    {ing.stock % 1 === 0 ? ing.stock : ing.stock.toFixed(2)} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL GASTO (solo monto) ───────────────────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-sm p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center"><MinusCircle size={24} /></div>
                <h3 className="text-2xl font-black">Registrar Gasto</h3>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Monto ($)</label>
              <input
                type="number"
                placeholder="0"
                autoFocus
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                className="w-full p-5 bg-gray-50 rounded-2xl font-black text-3xl text-red-600 text-center outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancelar</button>
              <button
                onClick={handleAddExpense}
                disabled={!expenseAmount}
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black shadow-lg disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                REGISTRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAGO (igual) ─────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-4xl flex flex-col md:flex-row overflow-hidden shadow-2xl max-h-[90vh]">
            <div className="flex-1 p-8 bg-gray-50 relative overflow-y-auto">
              <button onClick={() => setShowPaymentModal(false)} className="absolute top-6 right-6 p-2 bg-gray-200 rounded-full hover:bg-gray-300"><X size={20} /></button>
              <h3 className="text-2xl font-black mb-6">Finalizar Venta</h3>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase mb-2"><MapPin size={14} /> Localizador *</label>
                    <input
                      type="number" placeholder="" value={locator}
                      onChange={e => setLocator(e.target.value)}
                      className="w-full p-3 bg-gray-50 border rounded-xl font-black text-2xl outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase mb-2"><FileText size={14} /> Notas de Orden</label>
                    <input
                      type="text" placeholder="" value={orderNote}
                      onChange={e => setOrderNote(e.target.value)}
                      className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setIsManagement(v => !v)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isManagement ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                >
                  <div className="flex items-center gap-3">
                    <Crown size={22} className={isManagement ? "text-purple-600" : "text-gray-400"} />
                    <div className="text-left">
                      <p className={`font-black text-sm ${isManagement ? "text-purple-700" : "text-gray-600"}`}>Orden de Gerencia</p>
                      <p className={`text-xs font-medium ${isManagement ? "text-purple-500" : "text-gray-400"}`}>Sin cobro — descuenta inventario</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${isManagement ? "bg-purple-500" : "bg-gray-300"}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isManagement ? "translate-x-7" : "translate-x-1"}`} />
                  </div>
                </button>

                {!isManagement && (
                  <div>
                    <p className="text-gray-400 uppercase text-xs font-black mb-3 tracking-widest">Método de Pago</p>
                    <div className="grid grid-cols-2 gap-4">
                      {methods.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setMethodId(m.id); setCashInput(""); }}
                          className={`p-5 rounded-2xl border-4 flex flex-col items-center gap-2 transition-all ${methodId === m.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 bg-white"}`}
                        >
                          {m.isCash ? <Banknote size={28} /> : <CreditCard size={28} />}
                          <span className="font-bold text-lg">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 bg-white rounded-3xl border shadow-inner space-y-3 text-xl">
                  <div className="flex justify-between text-gray-400">
                    <span>Total:</span>
                    <span className={isManagement ? "line-through opacity-40" : ""}>{formatCurrency(total)}</span>
                  </div>
                  {isManagement && (
                    <div className="flex justify-between text-purple-600 font-black">
                      <span>Cobro:</span><span>$0 — Gerencia</span>
                    </div>
                  )}
                  {!isManagement && selectedMethod?.isCash && (
                    <>
                      <div className="flex justify-between text-blue-600 font-black">
                        <span>Recibido:</span><span>{formatCurrency(Number(cashInput))}</span>
                      </div>
                      <div className="flex justify-between text-green-600 text-3xl font-black border-t pt-3 mt-2">
                        <span>Cambio:</span><span>{formatCurrency(Math.max(0, Number(cashInput) - total))}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {err && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl font-bold text-center">{err}</div>}

              <button
                disabled={loading}
                onClick={pay}
                className={`w-full mt-6 text-white py-6 rounded-3xl font-black text-2xl shadow-xl active:scale-95 disabled:bg-gray-300 transition-all ${isManagement ? "bg-purple-600 hover:bg-purple-700" : "bg-green-500 hover:bg-green-600"}`}
              >
                {loading ? "REGISTRANDO..." : isManagement ? "✓ CONFIRMAR GERENCIA" : "CONFIRMAR PAGO"}
              </button>
            </div>

            {!isManagement && selectedMethod?.isCash && (
              <div className="w-full md:w-[380px] bg-white p-6 border-l flex flex-col justify-center">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumpadClick(num.toString())}
                      className="h-20 bg-gray-50 hover:bg-gray-100 rounded-2xl text-2xl font-bold active:bg-gray-200 border border-gray-100"
                    >{num}</button>
                  ))}
                  <button onClick={backspaceNumpad} className="h-20 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><Delete size={28} /></button>
                  <button onClick={clearNumpad} className="col-span-3 h-14 bg-red-50 text-red-500 rounded-xl font-bold">BORRAR</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CAJA / CIERRE ────────────────────────────────── */}
      {showCashReport && report && (() => {
        const methodsList = Object.values(report.byMethod || {});
        const cashSales = methodsList.filter((m) => m.isCash).reduce((acc, m) => acc + m.amount, 0);
        const otherMethods = methodsList.filter((m) => !m.isCash);
        const gasto = report.totalExpenses;

        const efectivoNeto = cashSales - gasto;
        const totalCheck = efectivoNeto + otherMethods.reduce((a, m) => a + m.amount, 0) + gasto;

        const openedAtStr = new Date(report.openedAt).toLocaleString("es-CO");
        const cutAtStr = new Date().toLocaleString("es-CO");

        return (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="p-8 pb-4 shrink-0 text-center">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calculator size={32} />
                </div>
                <h2 className="text-2xl font-black">Resumen de Turno</h2>
                <p className="text-gray-400 text-sm">Apertura: {openedAtStr}</p>
                <p className="text-gray-400 text-sm">Corte: {cutAtStr}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-4">
                {/* Base */}
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <span className="font-bold text-gray-500 text-sm uppercase tracking-wide">Base</span>
                  <span className="font-black text-xl">{formatCurrency(report.baseCash)}</span>
                </div>

                {/* Ventas estilo dibujo */}
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest">
                      Ventas
                    </p>
                    <span className="text-sm font-black text-blue-900">{formatCurrency(report.totalSold)}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-blue-800 font-bold">
                      <span>Efectivo</span>
                      <span>{formatCurrency(efectivoNeto)}</span>
                    </div>

                    {otherMethods.map((m, i) => (
                      <div key={i} className="flex justify-between text-sm text-blue-700 font-bold">
                        <span>{m.name}</span>
                        <span>{formatCurrency(m.amount)}</span>
                      </div>
                    ))}

                    <div className="flex justify-between text-sm text-red-700 font-black pt-1">
                      <span>Gasto</span>
                      <span>{formatCurrency(gasto)}</span>
                    </div>
                  </div>

                  <div className="border-t border-blue-200 mt-3 pt-3 flex justify-between font-black text-blue-400">
                    <span>Total</span>
                    <span>{formatCurrency(totalCheck)}</span>
                  </div>
                </div>

                {/* Gerencia */}
                {report.managementCount > 0 && (
                  <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                    <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">
                      Gerencia — {report.managementCount} órdenes
                    </p>

                    {report.managementOrders.map((o) => (
                      <div key={o.id} className="mb-4 last:mb-0 bg-white/60 rounded-2xl p-4 border border-purple-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-purple-700 uppercase">
                            {new Date(o.createdAt).toLocaleString("es-CO")}
                          </span>
                          <span className="text-sm font-black text-purple-800">
                            {formatCurrency(o.total)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {(o.items || []).length === 0 ? (
                            <div className="text-xs text-purple-600/70 italic">Sin items</div>
                          ) : (
                            o.items.map((it) => (
                              <div key={it.id} className="flex justify-between text-sm text-purple-800 font-bold">
                                <span className="truncate mr-3">
                                  {it.qty}× {it.dishName}
                                </span>
                                <span className="shrink-0">
                                  {formatCurrency(it.qty * it.price)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="p-8 pt-4 shrink-0 space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={printReport}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black transition-colors"
                  >
                    <Printer size={20} /> IMPRIMIR
                  </button>
                  <button
                    disabled={loading}
                    onClick={handleCloseSession}
                    className="flex-1 py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black shadow-lg transition-colors"
                  >
                    FINALIZAR JORNADA
                  </button>
                </div>
                <button
                  onClick={() => setShowCashReport(false)}
                  className="w-full py-3 font-bold text-gray-400 hover:text-gray-600"
                >
                  VOLVER AL POS
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
