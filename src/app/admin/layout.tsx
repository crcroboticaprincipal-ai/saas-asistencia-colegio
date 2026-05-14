"use client";

import { AdminSidebar } from "@/components/AdminSidebar";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, QrCode, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      <AdminSidebar />

      <main className="flex-1 h-[calc(100vh-64px)] md:h-full overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8 print:h-auto print:overflow-visible print:p-0">
        <div className="max-w-7xl mx-auto h-full print:h-auto print:max-w-none">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-panel border-t border-white/[0.08] z-50 flex items-center justify-around px-1 safe-bottom">
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[56px] ${
            pathname === "/admin" ? "text-blue-400" : "text-slate-500"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Panel</span>
        </Link>
        <Link
          href="/admin/importar"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[56px] ${
            pathname === "/admin/importar" ? "text-blue-400" : "text-slate-500"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Importar</span>
        </Link>
        <Link
          href="/admin/estudiantes"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[56px] ${
            pathname === "/admin/estudiantes" ? "text-blue-400" : "text-slate-500"
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px] font-medium">QR</span>
        </Link>
        <Link
          href="/"
          className="flex flex-col items-center justify-center -mt-7 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full text-white shadow-lg shadow-blue-500/30 border-4 border-[var(--background)]"
        >
          <QrCode className="w-6 h-6" />
        </Link>
        <Link
          href="/admin/reportes"
          className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[56px] ${
            pathname === "/admin/reportes" ? "text-blue-400" : "text-slate-500"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium">Reportes</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 p-2 text-slate-500 hover:text-red-400 transition-colors min-w-[56px]"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Salir</span>
        </button>
      </div>
    </div>
  );
}
