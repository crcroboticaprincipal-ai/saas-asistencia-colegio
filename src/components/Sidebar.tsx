"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, QrCode, FileText } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const routes = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Importar Alumnos", path: "/importar", icon: Users },
    { name: "Escáner", path: "/escaner", icon: QrCode },
    { name: "Reportes", path: "/reportes", icon: FileText },
  ];

  return (
    <aside className="w-64 h-full glass-panel border-r border-white/10 flex flex-col z-10 hidden md:flex">
      <div className="p-6 border-b border-white/5">
        <h1 className="text-xl font-bold text-gradient">San Rafael</h1>
        <p className="text-xs text-slate-400 mt-1">Gestión de Asistencia</p>
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
      
      <div className="p-4 mt-auto">
        <div className="bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-slate-300 text-center">UE Colegio Rafael Castillo</p>
        </div>
      </div>
    </aside>
  );
}
