"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, LogOut, QrCode, Shield } from "lucide-react";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const routes = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Importar Alumnos", path: "/admin/importar", icon: Users },
    { name: "Estudiantes / QR", path: "/admin/estudiantes", icon: QrCode },
    { name: "Reportes", path: "/admin/reportes", icon: FileText },
  ];

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
    <aside className="w-64 h-full glass-panel border-r border-white/[0.08] flex-col z-10 hidden md:flex">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center border border-blue-500/25">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gradient leading-tight">Qrono Admin</h1>
            <p className="text-[10px] text-slate-500 leading-tight">Control de Asistencia</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5">
        {routes.map((route) => {
          const isActive = pathname === route.path;
          return (
            <Link
              key={route.path}
              href={route.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <route.icon className={`w-5 h-5 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
              <span className="font-medium text-sm">{route.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-2 border-t border-white/5">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-blue-500/5 transition-colors w-full"
        >
          <QrCode className="w-5 h-5" />
          <span className="font-medium text-sm">Ir al Escáner</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
