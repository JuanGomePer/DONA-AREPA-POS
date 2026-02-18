"use client";
import { useState, useEffect } from "react";
import { Receipt, Calendar, ChevronDown, ChevronUp, Clock, Tag, Crown } from "lucide-react";

export default function AdminSales() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (val: number) => `$${val.toLocaleString("es-CO")}`;

  if (loading) return <div className="p-8 font-black animate-pulse text-blue-600">CARGANDO HISTORIAL...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen bg-gray-50/50">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-gray-900">HISTORIAL DE CIERRES</h1>
        <p className="text-gray-500 font-medium">Revisa el rendimiento por cada turno de caja</p>
      </header>

      {sessions.length === 0 ? (
        <div className="bg-white p-12 rounded-[40px] text-center border-2 border-dashed border-gray-200">
          <Receipt size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold text-lg">No hay cierres registrados aún.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const salesReal = session.salesReal || [];
            const salesManagement = session.salesManagement || [];
            const totalSession =
              typeof session.totalReal === "number"
                ? session.totalReal
                : salesReal.reduce((acc: number, s: any) => acc + (s.total || 0), 0);

            const isExpanded = expandedSession === session.id;

            return (
              <div
                key={session.id}
                className={`bg-white rounded-[32px] border transition-all ${
                  isExpanded ? "shadow-xl border-blue-500 ring-4 ring-blue-50" : "border-gray-200 hover:border-blue-200"
                }`}
              >
                {/* CABECERA */}
                <div
                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  className="p-7 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        session.closedAt ? "bg-gray-100 text-gray-400" : "bg-green-100 text-green-600"
                      }`}
                    >
                      <Calendar size={28} />
                    </div>
                    <div>
                      <h3 className="font-black text-xl text-gray-800">
                        {new Date(session.openedAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </h3>

                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-tight">
                          <Clock size={14} />{" "}
                          {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {session.closedAt
                            ? ` — ${new Date(session.closedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : " (Abierta)"}
                        </span>
                        {!session.closedAt && <span className="bg-green-500 w-2 h-2 rounded-full animate-ping" />}
                      </div>

                      {salesManagement.length > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Crown size={12} /> {salesManagement.length} Gerencia
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Recaudado</p>
                      <p className="text-3xl font-black text-blue-600 tracking-tighter">{formatCurrency(totalSession)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="text-blue-500" /> : <ChevronDown className="text-gray-300" />}
                  </div>
                </div>

                {/* DETALLE */}
                {isExpanded && (
                  <div className="px-7 pb-7 space-y-4">
                    {/* VENTAS REALES */}
                    <div className="bg-gray-50 rounded-[24px] p-6 border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Tag size={18} className="text-blue-500" />
                        <h4 className="font-black text-sm uppercase text-gray-700">Ventas reales</h4>
                      </div>

                      <div className="overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-200">
                            <tr>
                              <th className="pb-3">Ticket</th>
                              <th className="pb-3">Items</th>
                              <th className="pb-3">Método</th>
                              <th className="pb-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {salesReal.map((sale: any) => (
                              <tr key={sale.id} className="group">
                                <td className="py-4 font-bold text-gray-900">#{sale.ticketNo}</td>
                                <td className="py-4 text-xs text-gray-600 max-w-[200px]">
                                  {sale.items.map((it: any) => (
                                    <span key={it.id} className="block">
                                      {it.qty}x {it.dish.name}
                                    </span>
                                  ))}
                                </td>
                                <td className="py-4">
                                  <span className="text-[10px] font-black bg-white border px-2 py-1 rounded-lg uppercase text-gray-500">
                                    {sale.payment?.method?.name || "N/A"}
                                  </span>
                                </td>
                                <td className="py-4 text-right font-black text-blue-600">
                                  {formatCurrency(sale.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {salesReal.length === 0 && (
                        <p className="text-center py-6 text-gray-400 italic text-sm">No hubo ventas reales en este turno.</p>
                      )}
                    </div>

                    {/* GERENCIA (NO SUMA) */}
                    {salesManagement.length > 0 && (
                      <div className="bg-purple-50 rounded-[24px] p-6 border border-purple-100">
                        <div className="flex items-center gap-2 mb-4">
                          <Crown size={18} className="text-purple-600" />
                          <h4 className="font-black text-sm uppercase text-purple-700">Gerencia </h4>
                        </div>

                        <div className="space-y-3">
                          {salesManagement.map((sale: any) => (
                            <div key={sale.id} className="bg-white/70 border border-purple-100 rounded-2xl p-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-purple-700 uppercase">
                                  {new Date(sale.createdAt).toLocaleString("es-CO")}
                                </span>
                                <span className="text-sm font-black text-purple-800">{formatCurrency(sale.total)}</span>
                              </div>

                              <div className="space-y-1">
                                {sale.items.map((it: any) => (
                                  <div key={it.id} className="flex justify-between text-sm font-bold text-purple-800">
                                    <span className="truncate mr-3">
                                      {it.qty}× {it.dish.name}
                                    </span>
                                    <span className="shrink-0">{formatCurrency(it.qty * it.price)}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-2 text-[10px] font-black uppercase text-purple-600">
                                Sin cobro — orden de gerencia
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
