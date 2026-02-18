"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Printer, ArrowLeft, Crown } from "lucide-react";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ loc?: string; note?: string; management?: string }>;

export default function ReceiptPage(props: { params: Params; searchParams: SearchParams }) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const router = useRouter();

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loc = searchParams.loc || "N/A";
  const note = searchParams.note || "";
  const isManagement = searchParams.management === "1";

  useEffect(() => {
    fetch(`/api/sales/${params.id}`)
      .then((res) => res.json())
      .then((data) => { setSale(data); setLoading(false); })
      .catch((err) => console.error("Error cargando venta:", err));
  }, [params.id]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white font-black animate-pulse">
        GENERANDO RECIBO...
      </div>
    );
  }

  if (!sale || sale.error) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-red-500 font-bold">Venta no encontrada</h1>
        <button onClick={() => router.push("/pos")} className="text-blue-500 underline">Volver al POS</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <div id="receipt-content" className="bg-white p-6 shadow-lg w-full max-w-[380px] print:shadow-none print:p-2 print:max-w-full">

        {/* Encabezado */}
        <div className="text-center mb-4 border-b-2 border-black border-dashed pb-4">
          <h2 className="text-2xl font-black uppercase italic">Dona Arepa</h2>
          <p className="text-xs font-bold uppercase tracking-widest">Punto de Venta</p>
          <p className="text-[10px] text-gray-500">{new Date(sale.createdAt).toLocaleString("es-CO")}</p>
          {/* Badge gerencia */}
          {isManagement && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              <Crown size={12} /> Orden de Gerencia
            </div>
          )}
        </div>

        {/* Localizador */}
        <div className={`flex flex-col items-center justify-center border-2 rounded-2xl p-4 mb-4 ${isManagement ? "border-purple-400 bg-purple-50" : "border-black"}`}>
          <span className="text-[10px] font-black uppercase">Localizador</span>
          <span className={`text-6xl font-black ${isManagement ? "text-purple-700" : ""}`}>{loc}</span>
          <span className="text-[10px] font-bold mt-1 uppercase">Ticket #{sale.ticketNo}</span>
        </div>

        {/* Nota */}
        {note && (
          <div className="border-l-4 border-black pl-3 mb-4">
            <span className="text-[10px] font-black uppercase block">Nota:</span>
            <p className="text-sm font-bold italic leading-tight">"{note}"</p>
          </div>
        )}

        {/* Productos */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-black border-dotted">
              <th className="text-left py-1">CANT</th>
              <th className="text-left py-1">PRODUCTO</th>
              <th className="text-right py-1">TOTAL</th>
            </tr>
          </thead>
          <tbody className="font-medium">
            {sale.items.map((it: any) => (
              <tr key={it.id}>
                <td className="py-1 font-bold">{it.qty}</td>
                <td className="py-1 uppercase text-[12px]">{it.dish.name}</td>
                <td className="py-1 text-right">${(it.qty * it.price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="border-t-2 border-black border-dashed pt-4 space-y-1">
          <div className="flex justify-between font-bold">
            <span>TOTAL:</span>
            {isManagement ? (
              <span className="text-purple-600 font-black text-xl">GERENCIA</span>
            ) : (
              <span className="text-xl font-black">${sale.total.toLocaleString()}</span>
            )}
          </div>

          {/* Pago — solo si existe (no gerencia) */}
          {sale.payment && (
            <div className="text-[10px] flex justify-between uppercase">
              <span>Pago: {sale.payment.method.name}</span>
              {sale.payment.method.isCash && (
                <span>Cambio: ${(sale.payment.changeGiven || 0).toLocaleString()}</span>
              )}
            </div>
          )}

          {isManagement && (
            <div className="text-[10px] uppercase text-purple-600 font-bold text-center pt-1">
              Sin cargo — orden autorizada por gerencia
            </div>
          )}
        </div>

        <div className="text-center mt-6 pt-4 border-t border-gray-200 print:block hidden">
          <p className="text-[10px] font-bold italic">¡Gracias por tu compra!</p>
        </div>
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col gap-3 w-full max-w-[380px] no-print">
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all"
        >
          <Printer size={24} /> IMPRIMIR RECIBO
        </button>
        <button
          onClick={() => router.push("/pos")}
          className="w-full flex items-center justify-center gap-2 bg-white text-gray-600 py-4 rounded-2xl font-bold border-2 border-gray-200 active:scale-95 transition-all"
        >
          <ArrowLeft size={20} /> NUEVA VENTA
        </button>
      </div>

      <style jsx global>{`
        @media print {
          .no-print, nav, footer, button { display: none !important; }
          body { background-color: white !important; margin: 0; padding: 0; }
          #receipt-content { width: 100% !important; max-width: 80mm; padding: 0; margin: 0; box-shadow: none !important; border: none !important; }
          @page { margin: 0; size: auto; }
        }
      `}</style>
    </div>
  );
}