"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, LogOut, QrCode, UserCog, BookOpen, BarChart3, Building2 } from "lucide-react";

import Image from "next/image";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const routes = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Importar Alumnos", path: "/admin/importar", icon: Users },
    { name: "Estudiantes / QR", path: "/admin/estudiantes", icon: QrCode },
    { name: "Reportes", path: "/admin/reportes", icon: FileText },
    { name: "Analítica Avanzada", path: "/reportes", icon: BarChart3 },
  ];

  const routesRRHH = [
    { name: "Personal", path: "/admin/rrhh", icon: UserCog },
    { name: "Calendario", path: "/admin/rrhh/calendario", icon: LayoutDashboard },
  ];

  const routesAcademico = [
    { name: "Materias", path: "/admin/academico", icon: BookOpen },
    { name: "Pasar Lista", path: "/aula/pasar-lista", icon: BookOpen },
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
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Qrono Logo" width={168} height={56} className="w-auto h-full object-contain filter invert opacity-90" priority />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-gradient leading-tight tracking-tight">Qrono Admin</h1>
            <p className="text-[10px] text-slate-500 leading-tight">Control de Asistencia</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-4 mb-2">Principal</p>
        {routes.map((route) => {
          const isActive = pathname === route.path || (route.path !== '/admin' && pathname.startsWith(route.path));
          return (
            <Link
              key={route.path}
              href={route.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <route.icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
              <span className="font-medium text-sm">{route.name}</span>
            </Link>
          );
        })}

        <div className="pt-3">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-4 mb-2">RRHH</p>
          {routesRRHH.map((route) => {
            const isActive = pathname.startsWith(route.path);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <route.icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="font-medium text-sm">{route.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="pt-3">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-4 mb-2">Académico</p>
          {routesAcademico.map((route) => {
            const isActive = pathname.startsWith(route.path);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <route.icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                <span className="font-medium text-sm">{route.name}</span>
              </Link>
            );
          })}
        </div>
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
