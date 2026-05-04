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
    <aside className="w-64 h-full glass-panel border-r border-white/10 flex flex-col z-10 hidden md:flex">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-gradient">Admin Panel</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">Colegio Rafael Castillo</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {routes.map((route) => {
          const isActive = pathname === route.path;
          return (
            <Link
              key={route.path}
              href={route.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <route.icon className={`w-5 h-5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
              <span className="font-medium">{route.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-3">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors w-full"
        >
          <QrCode className="w-5 h-5" />
          <span className="font-medium text-sm">Ir al Escáner</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
