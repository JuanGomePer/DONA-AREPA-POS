"use client";
import { useState, useEffect } from "react";
import { Calendar, TrendingUp, FileText, Download, DollarSign, Crown, MinusCircle, X, Clock, Plus, Trash2 } from "lucide-react";
import { formatCO } from "@/lib/date";

const OP_CATEGORIES = [
  "ARRIENDO",
  "NOMINA",
  "TURNOS CAJA",
  "GAS",
  "LUZ",
  "AGUA",
  "CELULAR",
  "POST / INTERNET",
  "ACEITE / ASEO",
  "OTROS",
];

type OperatingExpense = {
  id: string;
  description: string;
  amount: number;
  month: number;
  year: number;
};

type SessionSummary = {
  id: string;
  openedAt: string;
  closedAt: string;
  baseCash: number;

  totalReal: number;        // vendido
  totalMgmt: number;
  totalExpenses: number;    // gastos

  investment: number;       // NUEVO
  profit: number;           // NUEVO

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

  totalInvestment: number;  // NUEVO
  profit: number;           // NUEVO

  byMethod: Record<string, { name: string; amount: number }>;
};

export default function AdminReports() {
  const [view, setView] = useState<"weekly" | "monthly">("monthly");
  const [weekly, setWeekly] = useState<Report[]>([]);
  const [monthly, setMonthly] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [opExpenses, setOpExpenses] = useState<OperatingExpense[]>([]);
  const [opForm, setOpForm] = useState({ description: OP_CATEGORIES[0], amount: "", customDescription: "" });
  const [showOpForm, setShowOpForm] = useState(false);

  type BreakdownItem = { name: string; unit: string; qty: number; cost: number };
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  useEffect(() => {
    if (!selectedReport?.month || !selectedReport?.year) {
      setOpExpenses([]);
      setBreakdown([]);
      setShowBreakdown(false);
      return;
    }
    const { month, year } = selectedReport;
    Promise.all([
      fetch(`/api/admin/contabilidad?month=${month}&year=${year}`).then(r => r.json()),
      fetch(`/api/admin/reports/breakdown?month=${month}&year=${year}`).then(r => r.json()),
    ]).then(([ops, bdwn]) => {
      setOpExpenses(ops);
      setBreakdown(Array.isArray(bdwn) ? bdwn : []);
    }).catch(console.error);
  }, [selectedReport]);

  const addOpExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport?.month || !selectedReport?.year) return;
    const amt = parseInt(opForm.amount);
    if (!opForm.description || !Number.isFinite(amt) || amt <= 0) return;
    const finalDesc = opForm.description === "OTROS" && opForm.customDescription.trim()
      ? opForm.customDescription.trim()
      : opForm.description;
    await fetch("/api/admin/contabilidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: finalDesc,
        amount: amt,
        month: selectedReport.month,
        year: selectedReport.year,
      }),
    });
    setOpForm({ description: OP_CATEGORIES[0], amount: "", customDescription: "" });
    setShowOpForm(false);
    fetch(`/api/admin/contabilidad?month=${selectedReport.month}&year=${selectedReport.year}`)
      .then(r => r.json())
      .then(setOpExpenses);
  };

  const deleteOpExpense = async (id: string) => {
    if (!selectedReport) return;
    await fetch(`/api/admin/contabilidad?id=${id}`, { method: "DELETE" });
    setOpExpenses(prev => prev.filter(e => e.id !== id));
  };

  const formatCurrency = (val: number) => `$${(val || 0).toLocaleString("es-CO")}`;

  const getMonthName = (month: number) => {
    const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return names[month - 1];
  };

  const getWeekRange = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const dm = (d: Date) =>
      formatCO(d, { day: "numeric", month: "numeric", timeZone: "America/Bogota" });
    const y = formatCO(end, { year: "numeric", timeZone: "America/Bogota" });
    return `${dm(start)} - ${dm(end)}/${y}`;
  };

  const downloadPdf = async (html: string) => {
    setIsDownloading(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;height:1px;border:none;";
      document.body.appendChild(iframe);

      try {
        iframe.contentDocument!.open();
        iframe.contentDocument!.write(html);
        iframe.contentDocument!.close();

        await new Promise<void>((resolve) => {
          if (iframe.contentDocument!.readyState === "complete") resolve();
          else iframe.onload = () => resolve();
        });
        await new Promise((r) => setTimeout(r, 800));

        const body = iframe.contentDocument!.body;
        const totalHeight = body.scrollHeight;
        iframe.style.height = totalHeight + "px";
        await new Promise((r) => setTimeout(r, 200));

        const canvas = await html2canvas(body, {
          scale: 1.5,
          useCORS: true,
          width: 900,
          height: totalHeight,
          windowWidth: 900,
        });

        const A4_W = 210;
        const A4_H = 297;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pxPerMm = canvas.width / A4_W;
        const pageHeightPx = A4_H * pxPerMm;
        let yOffset = 0;
        let page = 0;

        while (yOffset < canvas.height) {
          if (page > 0) pdf.addPage();
          const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          sliceCanvas.getContext("2d")!.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_W, sliceH / pxPerMm);
          yOffset += pageHeightPx;
          page++;
        }

        const title = selectedReport
          ? selectedReport.weekKey
            ? `semana-${selectedReport.weekStart?.slice(0, 10)}`
            : `${getMonthName(selectedReport.month!)}-${selectedReport.year}`.toLowerCase()
          : "reporte";
        pdf.save(`reporte-${title}.pdf`);
      } finally {
        document.body.removeChild(iframe);
      }
    } catch (e) {
      console.error("Error generando PDF:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  const previewReport = (report: Report) => {
    const isWeekly = !!report.weekKey;
    const title = isWeekly
      ? `Semana del ${getWeekRange(report.weekStart!)}`
      : `${getMonthName(report.month!)} ${report.year}`;

    const opTotal      = opExpenses.reduce((s, e) => s + e.amount, 0);
    const cashExpOnly  = report.totalExpenses - opTotal;
    const gananciaLibre = report.profit;

    const fmt = (n: number) => `$${(n || 0).toLocaleString("es-CO")}`;

    const ingRows = breakdown.map(row => `
      <tr>
        <td>${row.name}</td>
        <td class="num">${row.qty % 1 === 0 ? row.qty : row.qty.toFixed(2)} ${row.unit}</td>
        <td class="num neg">${row.cost > 0 ? fmt(row.cost) : "—"}</td>
      </tr>`).join("");

    const opRows = opExpenses.map(e => `
      <tr>
        <td>${e.description}</td>
        <td class="num neg">${fmt(e.amount)}</td>
      </tr>`).join("");

    const sessionRows = report.sessions.map(s => `
      <tr>
        <td>${new Date(s.openedAt).toLocaleDateString("es-CO", { timeZone:"America/Bogota", weekday:"short", day:"2-digit", month:"short" })}</td>
        <td>${new Date(s.openedAt).toLocaleTimeString("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit"})} – ${new Date(s.closedAt).toLocaleTimeString("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit"})}</td>
        <td class="num">${fmt(s.totalReal)}</td>
        <td class="num neg">${fmt(s.investment)}</td>
        <td class="num neg">${fmt(s.totalExpenses)}</td>
        <td class="num ${s.profit >= 0 ? "pos" : "neg2"}">${fmt(s.profit)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Balance ${title} — Doña Arepa</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#111;background:#fff;padding:32px 40px;max-width:860px;margin:auto}

  /* ── Header ── */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .brand{font-size:22px;font-weight:900;letter-spacing:-0.5px}
  .brand span{color:#2563eb}
  .meta{text-align:right;color:#555;font-size:11px;line-height:1.7}
  .period{font-size:15px;font-weight:700;color:#111;margin-top:2px}

  /* ── Divider ── */
  hr{border:none;border-top:2px solid #111;margin:18px 0}
  hr.light{border-top:1px solid #e5e7eb;margin:10px 0}

  /* ── Section title ── */
  .sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px;margin-top:20px}

  /* ── Summary grid ── */
  .summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px}
  .card .label{font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:4px}
  .card .value{font-size:20px;font-weight:900}
  .card.blue .value{color:#2563eb}
  .card.amber .value{color:#d97706}
  .card.red .value{color:#dc2626}
  .card.green .value{color:#16a34a}
  .card.dark{background:#111;border-color:#111;grid-column:1/-1}
  .card.dark .label{color:#9ca3af}
  .card.dark .value{color:#fff;font-size:28px}

  /* ── Tables ── */
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th{background:#f3f4f6;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;padding:7px 10px;text-align:left}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .num{text-align:right;font-weight:600}
  .neg{color:#dc2626}
  .neg2{color:#dc2626;font-weight:700}
  .pos{color:#16a34a;font-weight:700}
  tfoot td{font-weight:700;font-size:11px;background:#f9fafb;border-top:2px solid #e5e7eb}

  /* ── Footer ── */
  .footer{margin-top:36px;border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;color:#9ca3af;font-size:10px}

  @media print{body{padding:16px 20px}}
</style>
</head><body>

  <div class="header">
    <div>
      <div class="brand">DOÑA<span>AREPA</span></div>
      <div style="font-size:13px;font-weight:600;color:#374151;margin-top:4px">Balance ${isWeekly ? "Semanal" : "Mensual"}</div>
      <div class="period">${title}</div>
    </div>
    <div class="meta">
      <div>NIT / Razón social: Doña Arepa</div>
      <div>Generado: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}</div>
      <div>${report.sessions.length} turno${report.sessions.length !== 1 ? "s" : ""} · ${report.sessions.reduce((a,s)=>a+s.realCount,0)} órdenes</div>
    </div>
  </div>

  <hr>

  <!-- RESUMEN FINANCIERO -->
  <div class="sec">Resumen Financiero</div>
  <div class="summary">
    <div class="card blue">
      <div class="label">Total Vendido</div>
      <div class="value">${fmt(report.totalReal)}</div>
    </div>
    <div class="card amber">
      <div class="label">Inversión en Insumos</div>
      <div class="value">${fmt(report.totalInvestment)}</div>
    </div>
    ${cashExpOnly > 0 ? `
    <div class="card red">
      <div class="label">Gastos de Caja</div>
      <div class="value">${fmt(cashExpOnly)}</div>
    </div>` : ""}
    ${opTotal > 0 ? `
    <div class="card red">
      <div class="label">Gastos Operativos</div>
      <div class="value">${fmt(opTotal)}</div>
    </div>` : ""}
    <div class="card dark ${cashExpOnly > 0 || opTotal > 0 ? "" : ""}">
      <div class="label">Ganancia Libre</div>
      <div class="value">${fmt(gananciaLibre)}</div>
    </div>
  </div>

  <hr class="light">

  <!-- VENTAS POR MÉTODO -->
  <div class="sec">Ventas por Método de Pago</div>
  <table>
    <thead><tr><th>Método</th><th class="num">Monto</th><th class="num">% del Total</th></tr></thead>
    <tbody>
      ${Object.values(report.byMethod).map(m => `
        <tr>
          <td>${m.name}</td>
          <td class="num">${fmt(m.amount)}</td>
          <td class="num" style="color:#6b7280">${report.totalReal > 0 ? ((m.amount/report.totalReal)*100).toFixed(1)+"%" : "—"}</td>
        </tr>`).join("") || `<tr><td colspan="3" style="color:#9ca3af;text-align:center">Sin ventas registradas</td></tr>`}
    </tbody>
  </table>

  ${breakdown.length > 0 ? `
  <hr class="light">
  <!-- DESGLOSE INVERSIÓN -->
  <div class="sec">Desglose de Inversión por Ingrediente</div>
  <table>
    <thead><tr><th>Ingrediente</th><th class="num">Cantidad consumida</th><th class="num">Costo</th></tr></thead>
    <tbody>${ingRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total inversión en insumos</td>
        <td class="num neg">${fmt(report.totalInvestment)}</td>
      </tr>
    </tfoot>
  </table>` : ""}

  ${opExpenses.length > 0 ? `
  <hr class="light">
  <!-- GASTOS OPERATIVOS -->
  <div class="sec">Gastos Operativos del Mes</div>
  <table>
    <thead><tr><th>Concepto</th><th class="num">Valor</th></tr></thead>
    <tbody>${opRows}</tbody>
    <tfoot>
      <tr>
        <td>Total gastos operativos</td>
        <td class="num neg">${fmt(opTotal)}</td>
      </tr>
    </tfoot>
  </table>` : ""}

  <hr class="light">
  <!-- TURNOS -->
  <div class="sec">Detalle de Turnos (${report.sessions.length})</div>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Horario</th>
        <th class="num">Vendido</th>
        <th class="num">Inversión</th>
        <th class="num">Gastos</th>
        <th class="num">Ganancia</th>
      </tr>
    </thead>
    <tbody>${sessionRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTALES</td>
        <td class="num">${fmt(report.totalReal)}</td>
        <td class="num neg">${fmt(report.totalInvestment)}</td>
        <td class="num neg">${fmt(report.totalExpenses)}</td>
        <td class="num ${report.profit >= 0 ? "pos" : "neg2"}">${fmt(report.profit)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Doña Arepa — Sistema POS</span>
    <span>Documento generado el ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · Confidencial</span>
  </div>

</body></html>`;

    setPreviewHtml(html);
  };

  if (loading) return <div className="p-8 font-black animate-pulse text-blue-600">GENERANDO REPORTES...</div>;

  const data = view === "weekly" ? weekly : monthly;

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-gray-50/50">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-gray-900">REPORTES CONTABLES</h1>
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
            const title = isWeekly ? getWeekRange(report.weekStart!) : `${getMonthName(report.month!)} ${report.year}`;

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
                    <span className="text-xs font-bold text-gray-400 uppercase">Vendido</span>
                    <span className="text-2xl font-black text-blue-600">{formatCurrency(report.totalReal)}</span>
                  </div>

                  <div className="pt-3 border-t border-gray-200 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Materia Prima</span>
                      <span className="font-bold text-amber-600">-{formatCurrency(report.totalInvestment)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Gastos</span>
                      <span className="font-bold text-red-600">-{formatCurrency(report.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Ganancia</span>
                      <span className="font-bold text-green-600">{formatCurrency(report.profit)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
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

      {/* MODAL VISTA PREVIA */}
      {previewHtml && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white shrink-0">
            <span className="font-black text-sm uppercase tracking-wider">Vista previa del reporte</span>
            <div className="flex gap-3">
              <button
                onClick={() => downloadPdf(previewHtml)}
                disabled={isDownloading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait px-4 py-2 rounded-xl font-bold text-sm transition-colors"
              >
                <Download size={16} />
                {isDownloading ? "Generando..." : "Descargar PDF"}
              </button>
              <button
                onClick={() => setPreviewHtml(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="flex-1 w-full bg-white"
            title="Vista previa del reporte"
          />
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
                    onClick={() => previewReport(selectedReport)}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-bold transition-colors"
                  >
                    <FileText size={18} /> Vista previa
                  </button>
                  <button
                    onClick={() => { setSelectedReport(null); setShowOpForm(false); setOpExpenses([]); setBreakdown([]); setShowBreakdown(false); setOpForm({ description: OP_CATEGORIES[0], amount: "", customDescription: "" }); }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Vendido */}
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={18} className="text-blue-600" />
                  <h4 className="font-black text-sm uppercase text-blue-700">Vendido (Ventas Reales)</h4>
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
                  <span>Total Vendido</span>
                  <span>{formatCurrency(selectedReport.totalReal)}</span>
                </div>
              </div>

              {/* Inversión */}
              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-amber-600" />
                    <h4 className="font-black text-sm uppercase text-amber-700">Inversión en Insumos</h4>
                  </div>
                  {breakdown.length > 0 && (
                    <button
                      onClick={() => setShowBreakdown(v => !v)}
                      className="text-xs font-black text-amber-600 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-xl transition-colors"
                    >
                      {showBreakdown ? "Ocultar" : "Desglose"}
                    </button>
                  )}
                </div>

                {showBreakdown && breakdown.length > 0 && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-amber-200">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100">
                        <tr>
                          <th className="text-left p-2 font-black text-amber-800">Ingrediente</th>
                          <th className="text-right p-2 font-black text-amber-800">Cantidad</th>
                          <th className="text-right p-2 font-black text-amber-800">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-amber-50/40"}>
                            <td className="p-2 font-bold text-gray-700">{row.name}</td>
                            <td className="p-2 text-right text-gray-500 font-bold">
                              {row.qty % 1 === 0 ? row.qty : row.qty.toFixed(2)} {row.unit}
                            </td>
                            <td className="p-2 text-right font-black text-amber-700">
                              {row.cost > 0 ? `-${formatCurrency(row.cost)}` : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-between font-black text-amber-800">
                  <span>Total Inversión</span>
                  <span>-{formatCurrency(selectedReport.totalInvestment)}</span>
                </div>
              </div>

              {/* Gastos */}
              {(() => {
                const opTotal = opExpenses.reduce((s, e) => s + e.amount, 0);
                const cashExpensesOnly = selectedReport.totalExpenses - opTotal;
                if (cashExpensesOnly <= 0) return null;
                return (
                  <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                    <div className="flex items-center gap-2 mb-3">
                      <MinusCircle size={18} className="text-red-600" />
                      <h4 className="font-black text-sm uppercase text-red-700">Gastos de Caja</h4>
                    </div>
                    <div className="flex justify-between font-black text-red-800">
                      <span>Total Gastos de Caja</span>
                      <span>-{formatCurrency(cashExpensesOnly)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Gastos operativos (solo para reportes mensuales) */}
              {selectedReport.month && (
                <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MinusCircle size={18} className="text-red-500" />
                      <h4 className="font-black text-sm uppercase text-red-700">Gastos Operativos del Mes</h4>
                    </div>
                    <button
                      onClick={() => setShowOpForm(v => !v)}
                      className="flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>

                  {showOpForm && (
                    <form onSubmit={addOpExpense} className="mb-4 p-4 bg-white rounded-2xl border border-red-100 space-y-3">
                      <select
                        value={opForm.description}
                        onChange={e => setOpForm({ ...opForm, description: e.target.value, customDescription: "" })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-400"
                      >
                        {OP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      {opForm.description === "OTROS" && (
                        <input
                          type="text"
                          placeholder="¿Qué gasto fue?"
                          value={opForm.customDescription ?? ""}
                          onChange={e => setOpForm({ ...opForm, customDescription: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-400"
                          required
                          autoFocus
                        />
                      )}
                      <input
                        type="number"
                        placeholder="Valor (COP)"
                        min="1"
                        value={opForm.amount}
                        onChange={e => setOpForm({ ...opForm, amount: e.target.value })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800 text-sm outline-none focus:ring-2 focus:ring-red-400"
                        required
                        autoFocus={opForm.description !== "OTROS"}
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowOpForm(false)} className="flex-1 py-2 text-gray-400 font-bold text-sm">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 bg-red-500 text-white rounded-xl font-black text-sm hover:bg-red-600">Guardar</button>
                      </div>
                    </form>
                  )}

                  {opExpenses.length === 0 ? (
                    <p className="text-red-300 text-sm font-bold text-center py-2">Sin gastos operativos este mes</p>
                  ) : (
                    <div className="space-y-2">
                      {opExpenses.map(exp => (
                        <div key={exp.id} className="flex justify-between items-center group">
                          <span className="font-bold text-red-800 text-sm">{exp.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-red-700">-{formatCurrency(exp.amount)}</span>
                            <button
                              onClick={() => deleteOpExpense(exp.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-red-200 pt-2 flex justify-between">
                        <span className="font-black text-red-700 text-sm uppercase">Total</span>
                        <span className="font-black text-red-700">-{formatCurrency(opExpenses.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ganancia */}
              <div className={`rounded-2xl p-6 text-center ${selectedReport.profit >= 0 ? "bg-gray-900" : "bg-red-700"} text-white`}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {opExpenses.length > 0 ? "Ganancia libre" : "Ganancia"}
                </p>
                <p className="text-4xl font-black">{formatCurrency(selectedReport.profit)}</p>
              </div>

              {/* Turnos individuales */}
              <div className="pt-4">
                <h4 className="font-black text-sm uppercase text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-gray-400" />
                  Turnos individuales ({selectedReport.sessions.length})
                </h4>

                <div className="space-y-3">
                  {selectedReport.sessions.map((session) => (
                    <div key={session.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-400" />
                          <span className="font-black text-gray-800">
                            {new Date(session.openedAt).toLocaleDateString("es-CO", {
                              timeZone: "America/Bogota",
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {new Date(session.openedAt).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(session.closedAt).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Vendido</p>
                          <p className="font-black text-blue-600">{formatCurrency(session.totalReal)}</p>
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Inversión</p>
                          <p className="font-black text-amber-600">-{formatCurrency(session.investment)}</p>
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Gastos</p>
                          <p className="font-black text-red-600">-{formatCurrency(session.totalExpenses)}</p>
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Ganancia</p>
                          <p className="font-black text-green-600">{formatCurrency(session.profit)}</p>
                        </div>
                      </div>

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
