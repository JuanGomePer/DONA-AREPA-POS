import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* El Sidebar fijo a la izquierda */}
      <AdminSidebar />
      
      {/* El contenido de la página con un margen izquierdo para no quedar debajo del sidebar */}
      <main className="flex-1 ml-64 p-4">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}