"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, Minus, ShoppingCart, Trash2, Banknote, CreditCard, 
  Delete, LogOut, Calculator, X, Receipt, Lock, PlayCircle, MapPin, FileText
} from "lucide-react";

type Dish = { id: string; name: string; price: number; enabled: boolean };
type PaymentMethod = { id: string; name: string; enabled: boolean; isCash: boolean };
type Denomination = { id: string; type: string; value: number; enabled: boolean };

// AÑADIMOS VALORES POR DEFECTO (= []) PARA EVITAR EL ERROR DE UNDEFINED
export default function PosClient({
  dishes = [],
  methods = [],
  denoms = [],
}: {
  dishes?: Dish[];
  methods?: PaymentMethod[];
  denoms?: Denomination[];
}) {
  const r = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  
  // USAMOS UN ESTADO INICIAL SEGURO
  const [methodId, setMethodId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCashReport, setShowCashReport] = useState(false);
  const [cashInput, setCashInput] = useState("");

  const [locator, setLocator] = useState(""); 
  const [orderNote, setOrderNote] = useState("");

  const [report, setReport] = useState<{ 
    id: string; 
    totalSold: number; 
    count: number; 
    byMethod: Record<string, number>;
    openedAt: string;
  } | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);

  // EFECTO PARA CONFIGURAR EL MÉTODO INICIAL CUANDO LOS MÉTODOS CARGUEN
  useEffect(() => {
    setMounted(true);
    fetchReport();
    if (methods.length > 0 && !methodId) {
      setMethodId(methods[0].id);
    }
  }, [methods, methodId]);

  const selectedMethod = methods.find((m) => m.id === methodId);
  const formatCurrency = (val: number) => `$${val.toLocaleString("es-CO")}`;

  const cartItems = useMemo(() => {
    const map = new Map(dishes.map((d) => [d.id, d]));
    return Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([dishId, qty]) => ({
        dishId,
        qty,
        dish: map.get(dishId)!,
        line: (map.get(dishId)?.price || 0) * qty,
      }));
  }, [cart, dishes]);

  const total = useMemo(() => cartItems.reduce((acc, it) => acc + it.line, 0), [cartItems]);

  const fetchReport = async () => {
    try {
      const res = await fetch("/api/cash-report");
      const data = await res.json();
      if (data.session) {
        setReport(data.session);
        setSessionActive(true);
      } else {
        setSessionActive(false);
      }
    } catch (e) {
      console.error("Error al obtener estado de caja");
    }
  };

  const handleOpenSession = async () => {
    setLoading(true);
    try {
      await fetch("/api/cash-report", { 
        method: "POST", 
        body: JSON.stringify({ action: "OPEN" }) 
      });
      await fetchReport();
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!confirm("¿Deseas finalizar la jornada y cerrar sesión?")) return;
    setLoading(true);
    try {
      await fetch("/api/cash-report", { method: "POST", body: JSON.stringify({ action: "CLOSE" }) });
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Error durante el cierre:", e);
    } finally {
      setLoading(false);
      window.location.href = "/login"; 
    }
  };

  function addDish(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }

  function subDish(id: string) {
    setCart((c) => {
      const next = { ...c };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });
  }

  const handleNumpadClick = (val: string) => setCashInput((prev) => prev + val);
  const clearNumpad = () => setCashInput("");
  const backspaceNumpad = () => setCashInput((prev) => prev.slice(0, -1));

  async function pay() {
    setErr(null);
    if (!locator.trim()) {
      setErr("Por favor asigna un localizador.");
      return;
    }
    const cashReceived = selectedMethod?.isCash ? Number(cashInput) : null;
    if (selectedMethod?.isCash && (!cashReceived || cashReceived < total)) {
      setErr(`Efectivo insuficiente.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((it) => ({ dishId: it.dishId, qty: it.qty })),
          payment: { methodId, cashReceived },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en venta");
      
      const params = new URLSearchParams({ loc: locator, note: orderNote });
      r.push(`/receipt/${data.saleId}?${params.toString()}`);
      
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

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
                disabled={loading}
                onClick={handleOpenSession}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
                <PlayCircle /> {loading ? "ABRIENDO..." : "ABRIR TURNO"}
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden font-sans text-gray-900">
      
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white font-black">DA</div>
          <h1 className="font-bold text-xl tracking-tight">Dona Arepa POS</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchReport(); setShowCashReport(true); }} className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-bold hover:bg-amber-100 transition-colors border border-amber-200">
            <Calculator size={20} />
            <span>Resumen de Caja</span>
          </button>
          <button disabled={loading} onClick={handleCloseSession} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50">
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dishes.map((d) => (
              <button key={d.id} onClick={() => addDish(d.id)} className="bg-white p-6 rounded-3xl shadow-sm border-2 border-transparent active:border-blue-500 active:scale-95 transition-all flex flex-col items-center text-center justify-center min-h-[140px]">
                <span className="font-bold text-gray-800 text-lg leading-tight">{d.name}</span>
                <span className="text-blue-600 font-bold text-xl mt-2">{formatCurrency(d.price)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full md:w-[400px] bg-white shadow-2xl flex flex-col h-full border-l">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h2 className="font-black text-xl uppercase tracking-tighter flex items-center gap-2">
              <Receipt size={24} className="text-blue-600" /> Orden
            </h2>
            <button onClick={() => setCart({})} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={20}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                <ShoppingCart size={80} strokeWidth={1} />
                <p className="font-medium mt-4 italic text-lg">Esperando pedido...</p>
              </div>
            ) : (
              cartItems.map((it) => (
                <div key={it.dishId} className="flex items-center justify-between p-4 bg-white border rounded-2xl shadow-sm">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{it.dish.name}</div>
                    <div className="text-blue-600 font-medium">{formatCurrency(it.dish.price)}</div>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => subDish(it.dishId)} className="bg-white shadow-sm p-1.5 rounded-lg active:scale-90"><Minus size={16}/></button>
                    <span className="font-black text-lg w-4 text-center">{it.qty}</span>
                    <button onClick={() => addDish(it.dishId)} className="bg-white shadow-sm p-1.5 rounded-lg active:scale-90"><Plus size={16}/></button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-gray-500 font-bold uppercase text-xs">Total</span>
              <span className="text-4xl font-black text-gray-900 leading-none">{formatCurrency(total)}</span>
            </div>
            <button
              disabled={cartItems.length === 0}
              onClick={() => { 
                setCashInput(""); 
                setLocator(""); 
                setOrderNote("");
                setShowPaymentModal(true); 
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white py-5 rounded-2xl text-2xl font-black transition-all shadow-lg active:scale-95"
            >
              COBRAR
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGO */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-4xl flex flex-col md:flex-row overflow-hidden shadow-2xl max-h-[90vh]">
            <div className="flex-1 p-8 bg-gray-50 relative overflow-y-auto">
              <button onClick={() => setShowPaymentModal(false)} className="absolute top-6 right-6 p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"><X size={20}/></button>
              <h3 className="text-2xl font-black mb-6">Finalizar Venta</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase mb-2"><MapPin size={14}/> Localizador *</label>
                    <input 
                      type="number" 
                      placeholder=""
                      value={locator}
                      onChange={(e) => setLocator(e.target.value)}
                      className="w-full p-3 bg-gray-50 border rounded-xl font-black text-2xl outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="bg-white p-4 rounded-2xl border shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase mb-2"><FileText size={14}/> Notas de Orden</label>
                    <input 
                      type="text" 
                      placeholder=""
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      className="w-full p-3 bg-gray-50 border rounded-xl font-medium outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 uppercase text-xs font-black mb-3 tracking-widest">Método de Pago</p>
                  <div className="grid grid-cols-2 gap-4">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setMethodId(m.id); setCashInput(""); }}
                        className={`p-5 rounded-2xl border-4 flex flex-col items-center gap-2 transition-all ${
                          methodId === m.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 bg-white"
                        }`}
                      >
                        {m.isCash ? <Banknote size={28} /> : <CreditCard size={28} />}
                        <span className="font-bold text-lg">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-white rounded-3xl border shadow-inner space-y-3 text-xl">
                  <div className="flex justify-between text-gray-400">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  {selectedMethod?.isCash && (
                    <>
                      <div className="flex justify-between text-blue-600 font-black">
                        <span>Recibido:</span>
                        <span>{formatCurrency(Number(cashInput))}</span>
                      </div>
                      <div className="flex justify-between text-green-600 text-3xl font-black border-t pt-3 mt-2">
                        <span>Cambio:</span>
                        <span>{formatCurrency(Math.max(0, Number(cashInput) - total))}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {err && <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl font-bold text-center">{err}</div>}
              <button 
                disabled={loading}
                onClick={pay}
                className="w-full mt-8 bg-green-500 hover:bg-green-600 text-white py-6 rounded-3xl font-black text-2xl shadow-xl active:scale-95 disabled:bg-gray-300 transition-all"
              >
                {loading ? "REGISTRANDO..." : "CONFIRMAR PAGO"}
              </button>
            </div>
            {selectedMethod?.isCash && (
              <div className="w-full md:w-[380px] bg-white p-6 border-l flex flex-col justify-center">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0].map((num) => (
                    <button key={num} onClick={() => handleNumpadClick(num.toString())} className="h-20 bg-gray-50 hover:bg-gray-100 rounded-2xl text-2xl font-bold active:bg-gray-200 border border-gray-100">
                      {num}
                    </button>
                  ))}
                  <button onClick={backspaceNumpad} className="h-20 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><Delete size={28} /></button>
                  <button onClick={clearNumpad} className="col-span-3 h-14 bg-red-50 text-red-500 rounded-xl font-bold">BORRAR</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL RESUMEN DE CAJA */}
      {showCashReport && report && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calculator size={40} />
              </div>
              <h2 className="text-3xl font-black text-gray-900">Cierre de Turno</h2>
              <p className="text-gray-500 font-medium">Iniciado: {new Date(report.openedAt).toLocaleString("es-CO")}</p>
            </div>
            <div className="space-y-4 mb-10">
              <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100 border-dashed text-center">
                <span className="text-blue-500 font-bold uppercase text-xs tracking-widest block mb-1">Total en Caja</span>
                <span className="text-4xl font-black text-blue-700">{formatCurrency(report.totalSold)}</span>
                <p className="text-blue-400 text-sm mt-2 font-bold">{report.count} Órdenes hoy</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button disabled={loading} onClick={handleCloseSession} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-lg">FINALIZAR JORNADA</button>
              <button onClick={() => setShowCashReport(false)} className="w-full py-4 font-bold text-gray-400 hover:text-gray-600">VOLVER AL POS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}