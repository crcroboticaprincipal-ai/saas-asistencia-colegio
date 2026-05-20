"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FileText, LogOut, QrCode, UserCog, BookOpen, GraduationCap, Building2, Upload } from "lucide-react";

import Image from "next/image";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const routes = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Importar Alumnos", path: "/admin/importar", icon: Users },
    { name: "Estudiantes / QR", path: "/admin/estudiantes", icon: QrCode },
    { name: "Reportes", path: "/admin/reportes", icon: FileText },
  ];

  const routesRRHH = [
    { name: "Personal", path: "/admin/rrhh", icon: UserCog },
    { name: "Importar Personal", path: "/admin/rrhh/importar", icon: Upload },
    { name: "Calendario", path: "/admin/rrhh/calendario", icon: LayoutDashboard },
  ];

  const routesAcademico = [
    { name: "Materias", path: "/admin/academico", icon: BookOpen },
    { name: "Gestión Materias", path: "/admin/materias", icon: GraduationCap },
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
    <aside className="w-64 h-full glass-panel border-r border-slate-200/60 flex-col z-10 hidden md:flex">
      <div className="px-5 py-5 border-b border-slate-200/60">
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Asisto Logo" width={235} height={78} className="w-auto h-full object-contain opacity-90" priority />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-gradient leading-tight tracking-tight">Asisto Admin</h1>
            <p className="text-[10px] text-slate-500 leading-tight">Control de Asistencia</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-2">Principal</p>
        {routes.map((route) => {
          const isActive = pathname === route.path || (route.path !== '/admin' && pathname.startsWith(route.path));
          return (
            <Link
              key={route.path}
              href={route.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200/50 shadow-[0_0_12px_rgba(79,70,229,0.05)] font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
              }`}
            >
              <route.icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span className="font-medium text-sm">{route.name}</span>
            </Link>
          );
        })}

        <div className="pt-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-2">RRHH</p>
          {routesRRHH.map((route) => {
            const isActive = pathname.startsWith(route.path);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50 shadow-[0_0_12px_rgba(16,185,129,0.05)] font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <route.icon className={`w-4 h-4 ${isActive ? "text-emerald-500" : "text-slate-400"}`} />
                <span className="font-medium text-sm">{route.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="pt-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-4 mb-2">Académico</p>
          {routesAcademico.map((route) => {
            const isActive = pathname.startsWith(route.path);
            return (
              <Link
                key={route.path}
                href={route.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200/50 shadow-[0_0_12px_rgba(79,70,229,0.05)] font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <route.icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="font-medium text-sm">{route.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 space-y-2 border-t border-slate-200/60">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent transition-colors w-full"
        >
          <QrCode className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
          <span className="font-medium text-sm">Ir al Escáner</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-colors w-full"
        >
          <LogOut className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
