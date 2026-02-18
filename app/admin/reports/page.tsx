"use client";
import { useState, useEffect } from "react";
import { Calendar, TrendingUp, Printer, DollarSign, Crown, MinusCircle, X, Clock } from "lucide-react";

type SessionSummary = {
  id: string;
  openedAt: string;
  closedAt: string;
  baseCash: number;
  totalReal: number;
  totalMgmt: number;
  totalExpenses: number;
  byMethod: Record<string, { name: string; amount: number }>;
  realCount: number;
  mgmtCount: number;
};

type Report = {
  weekKey?: string;
  weekStart?: string;
  monthKey?: string;
  year?: number;
  month?: number;
  sessions: SessionSummary[];
  totalReal: number;
  totalMgmt: number;
  totalExpenses: number;
  byMethod: Record<string, { name: string; amount: number }>;
};

export default function AdminReports() {
  const [view, setView] = useState<"weekly" | "monthly">("monthly");
  const [weekly, setWeekly] = useState<Report[]>([]);
  const [monthly, setMonthly] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((res) => res.json())
      .then((data) => {
        setWeekly(data.weekly || []);
        setMonthly(data.monthly || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (val: number) => `$${val.toLocaleString("es-CO")}`;

  const getMonthName = (month: number) => {
    const names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return names[month - 1];
  };

  const getWeekRange = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  };

  const printReport = (report: Report) => {
    const isWeekly = !!report.weekKey;
    const title = isWeekly
      ? `Semana del ${getWeekRange(report.weekStart!)}`
      : `${getMonthName(report.month!)} ${report.year}`;

    const netIncome = report.totalReal - report.totalExpenses;

    const html = `<!DOCTYPE html><html><head><title>Reporte - ${title}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Arial',sans-serif; padding:30px; max-width:800px; margin:auto; }
      h1 { font-size:24px; margin-bottom:5px; }
      .subtitle { font-size:14px; color:#666; margin-bottom:20px; }
      .divider { border-top:2px solid #000; margin:20px 0; }
      .section { margin:20px 0; }
      .section-title { font-size:16px; font-weight:bold; text-transform:uppercase; color:#444; margin-bottom:10px; }
      .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; }
      .row.bold { font-weight:bold; font-size:18px; }
      .indent { padding-left:20px; color:#555; }
      .total-box { background:#f0f0f0; padding:20px; border-radius:8px; text-align:center; margin:20px 0; }
      .total-box .label { font-size:12px; color:#666; text-transform:uppercase; }
      .total-box .value { font-size:32px; font-weight:bold; color:#000; }
      .session-item { background:#f9f9f9; padding:12px; margin:8px 0; border-left:4px solid #3b82f6; }
      .footer { text-align:center; font-size:11px; color:#999; margin-top:30px; }
    </style></head><body>
      <h1>DONA AREPA — REPORTE ${isWeekly ? "SEMANAL" : "MENSUAL"}</h1>
      <p class="subtitle">${title}</p>
      <div class="divider"></div>
      
      <div class="section">
        <div class="section-title">Resumen de Turnos (${report.sessions.length})</div>
        ${report.sessions.map(s => `
          <div class="session-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:bold;">${new Date(s.openedAt).toLocaleDateString("es-CO")}</span>
              <span>${formatCurrency(s.totalReal)}</span>
            </div>
            <div style="font-size:11px; color:#666;">
              ${s.realCount} ventas • Base: ${formatCurrency(s.baseCash)} • Gastos: ${formatCurrency(s.totalExpenses)}
              ${s.mgmtCount > 0 ? ` • ${s.mgmtCount} gerencia` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">Ventas Reales (${report.sessions.reduce((acc, s) => acc + s.realCount, 0)} órdenes)</div>
        ${Object.values(report.byMethod)
          .map((m) => `<div class="row indent"><span>${m.name}</span><span>${formatCurrency(m.amount)}</span></div>`)
          .join("") || '<div class="row indent"><span>Sin ventas</span><span>$0</span></div>'}
        <div class="row bold"><span>Total Ventas</span><span>${formatCurrency(report.totalReal)}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Gastos</div>
        <div class="row bold"><span>Total Gastos</span><span>-${formatCurrency(report.totalExpenses)}</span></div>
      </div>

      ${
        report.totalMgmt > 0
          ? `
      <div class="section">
        <div class="section-title">Gerencia (${report.sessions.reduce((acc, s) => acc + s.mgmtCount, 0)} órdenes — sin cobro)</div>
        <div class="row"><span>Valor registrado</span><span>${formatCurrency(report.totalMgmt)}</span></div>
      </div>
      `
          : ""
      }

      <div class="divider"></div>
      <div class="total-box">
        <div class="label">Ingreso Neto (Para declaración)</div>
        <div class="value">${formatCurrency(netIncome)}</div>
      </div>

      <div class="footer">
        Generado: ${new Date().toLocaleString("es-CO")}<br>
        ${report.sessions.length} turnos de caja incluidos
      </div>
    </body></html>`;

    const w = window.open("", "_blank", "width=800,height=900");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  if (loading) return <div className="p-8 font-black animate-pulse text-blue-600">GENERANDO REPORTES...</div>;

  const data = view === "weekly" ? weekly : monthly;

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-gray-50/50">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-gray-900">REPORTES CONTABLES</h1>
        <p className="text-gray-500 font-medium">Resúmenes para declaración de impuestos</p>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-200 rounded-2xl mb-8 max-w-md">
        <button
          onClick={() => setView("monthly")}
          className={`flex-1 py-3 rounded-xl font-black transition-all ${
            view === "monthly" ? "bg-white text-blue-600 shadow-md" : "text-gray-500"
          }`}
        >
          MENSUAL
        </button>
        <button
          onClick={() => setView("weekly")}
          className={`flex-1 py-3 rounded-xl font-black transition-all ${
            view === "weekly" ? "bg-white text-blue-600 shadow-md" : "text-gray-500"
          }`}
        >
          SEMANAL
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-white p-12 rounded-[40px] text-center border-2 border-dashed border-gray-200">
          <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold text-lg">No hay datos para mostrar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((report) => {
            const isWeekly = !!report.weekKey;
            const title = isWeekly
              ? getWeekRange(report.weekStart!)
              : `${getMonthName(report.month!)} ${report.year}`;

            const netIncome = report.totalReal - report.totalExpenses;

            return (
              <button
                key={report.weekKey || report.monthKey}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-3xl border border-gray-200 p-6 text-left hover:border-blue-400 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={18} className="text-blue-500" />
                  <h3 className="font-black text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
                    {title}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase">Ingreso Neto</span>
                    <span className="text-2xl font-black text-green-600">{formatCurrency(netIncome)}</span>
                  </div>

                  <div className="pt-3 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Ventas</span>
                      <span className="font-bold text-blue-600">{formatCurrency(report.totalReal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Gastos</span>
                      <span className="font-bold text-red-600">-{formatCurrency(report.totalExpenses)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">{report.sessions.length} turnos</span>
                    {report.totalMgmt > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">
                        Incluye gerencia
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* MODAL DETALLE */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white rounded-t-[40px] shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black">
                    {selectedReport.weekKey
                      ? `Semana del ${getWeekRange(selectedReport.weekStart!)}`
                      : `${getMonthName(selectedReport.month!)} ${selectedReport.year}`}
                  </h3>
                  <p className="text-blue-100 text-sm font-medium mt-1">
                    {selectedReport.sessions.length} turnos • {selectedReport.sessions.reduce((acc, s) => acc + s.realCount, 0)} órdenes reales
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReport(selectedReport)}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-bold transition-colors"
                  >
                    <Printer size={18} /> Imprimir
                  </button>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Ventas */}
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={18} className="text-blue-600" />
                  <h4 className="font-black text-sm uppercase text-blue-700">Ventas Reales</h4>
                </div>
                {Object.values(selectedReport.byMethod).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Sin ventas registradas</p>
                ) : (
                  Object.values(selectedReport.byMethod).map((m, i) => (
                    <div key={i} className="flex justify-between text-sm text-blue-800 font-bold mb-2">
                      <span>{m.name}</span>
                      <span>{formatCurrency(m.amount)}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-blue-200 mt-3 pt-3 flex justify-between font-black text-blue-900 text-base">
                  <span>Total Ventas</span>
                  <span>{formatCurrency(selectedReport.totalReal)}</span>
                </div>
              </div>

              {/* Gastos */}
              <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                <div className="flex items-center gap-2 mb-3">
                  <MinusCircle size={18} className="text-red-600" />
                  <h4 className="font-black text-sm uppercase text-red-700">Gastos</h4>
                </div>
                <div className="flex justify-between font-black text-red-800">
                  <span>Total Gastos</span>
                  <span>-{formatCurrency(selectedReport.totalExpenses)}</span>
                </div>
              </div>

              {/* Gerencia */}
              {selectedReport.totalMgmt > 0 && (
                <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown size={18} className="text-purple-600" />
                    <h4 className="font-black text-sm uppercase text-purple-700">
                      Gerencia ({selectedReport.sessions.reduce((acc, s) => acc + s.mgmtCount, 0)} órdenes)
                    </h4>
                  </div>
                  <div className="flex justify-between font-bold text-purple-800">
                    <span>Valor Registrado</span>
                    <span>{formatCurrency(selectedReport.totalMgmt)}</span>
                  </div>
                </div>
              )}

              {/* Total neto */}
              <div className="bg-gray-900 text-white rounded-2xl p-6 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ingreso Neto</p>
                <p className="text-sm text-gray-300 mb-3">(Para declaración de impuestos)</p>
                <p className="text-4xl font-black">{formatCurrency(selectedReport.totalReal - selectedReport.totalExpenses)}</p>
              </div>

              {/* Turnos individuales */}
              <div className="pt-4">
                <h4 className="font-black text-sm uppercase text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-gray-400" />
                  Turnos individuales ({selectedReport.sessions.length})
                </h4>
                <div className="space-y-3">
                  {selectedReport.sessions.map((session) => (
                    <div key={session.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-400" />
                          <span className="font-black text-gray-800">
                            {new Date(session.openedAt).toLocaleDateString("es-CO", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {new Date(session.openedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(session.closedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Base</p>
                          <p className="font-black text-gray-700">{formatCurrency(session.baseCash)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Ventas</p>
                          <p className="font-black text-blue-600">{formatCurrency(session.totalReal)}</p>
                          <p className="text-xs text-gray-400 font-medium">{session.realCount} órdenes</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Gastos</p>
                          <p className="font-black text-red-600">-{formatCurrency(session.totalExpenses)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Neto</p>
                          <p className="font-black text-green-600">
                            {formatCurrency(session.baseCash + session.totalReal - session.totalExpenses)}
                          </p>
                        </div>
                      </div>

                      {Object.keys(session.byMethod).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Por método</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.values(session.byMethod).map((m, i) => (
                              <span key={i} className="text-xs bg-white px-3 py-1 rounded-lg border border-gray-100 font-bold text-gray-600">
                                {m.name}: {formatCurrency(m.amount)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {session.mgmtCount > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-black uppercase">
                          <Crown size={12} /> {session.mgmtCount} gerencia
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}