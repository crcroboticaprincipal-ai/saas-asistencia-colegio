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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-900">
      <AdminSidebar />

      <main className="flex-1 h-[calc(100vh-64px)] md:h-full overflow-y-auto bg-slate-900/50 p-4 md:p-8 pb-20 md:pb-8">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation — Admin */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-panel border-t border-white/10 z-50 flex items-center justify-around px-2">
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            pathname === "/admin" ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">Dashboard</span>
        </Link>
        <Link
          href="/admin/importar"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            pathname === "/admin/importar" ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium">Importar</span>
        </Link>
        <Link
          href="/"
          className="flex flex-col items-center justify-center -mt-8 w-14 h-14 bg-emerald-600 rounded-full text-white shadow-lg shadow-emerald-500/40 border-4 border-slate-900"
        >
          <QrCode className="w-6 h-6" />
        </Link>
        <Link
          href="/admin/reportes"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            pathname === "/admin/reportes" ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium">Reportes</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-rose-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Salir</span>
        </button>
      </div>
    </div>
  );
}
