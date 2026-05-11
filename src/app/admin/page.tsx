"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Users, Activity, LogIn, LogOut, ShieldAlert, AlertCircle } from "lucide-react";

type Asistencia = {
  id: string;
  estudiante_id: string;
  tipo: "ENTRADA" | "SALIDA";
  fecha: string;
  hora: string;
  estudiantes: {
    nombre_completo: string;
    grado: string;
    seccion: string;
  };
};

export default function AdminDashboardPage() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    fetchInitialData();
    fetchTotalEstudiantes();

    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "asistencias" }, () => {
        fetchInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTotalEstudiantes = async () => {
    const { count } = await supabase.from("estudiantes").select("id", { count: "exact", head: true });
    setTotalEstudiantes(count || 0);
  };

  const fetchInitialData = async () => {
    try {
      const { data, error } = await supabase
        .from("asistencias")
        .select(`
          id, estudiante_id, tipo, fecha, hora,
          estudiantes ( nombre_completo, grado, seccion )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setAsistencias((data as unknown) as Asistencia[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSemaforoColor = (incidencias: number) => {
    if (incidencias <= 1) return { bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", emoji: "🟢", label: "Regular" };
    if (incidencias <= 3) return { bg: "bg-amber-500/15 text-amber-400 border-amber-500/25", emoji: "🟡", label: "Atención" };
    return { bg: "bg-red-500/15 text-red-400 border-red-500/25", emoji: "🔴", label: "Crítico" };
  };

  // Métricas
  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecords = asistencias.filter((a) => a.fecha === todayStr);
  const entradasHoy = todayRecords.filter((a) => a.tipo === "ENTRADA").length;
  const salidasHoy = todayRecords.filter((a) => a.tipo === "SALIDA").length;

  // Semáforo mensual
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthRecords = asistencias.filter((a) => {
    const d = new Date(a.fecha);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const incidenciasPorEstudiante = monthRecords.reduce((acc, curr) => {
    const key = curr.estudiante_id;
    if (!acc[key]) acc[key] = { ...curr.estudiantes, count: 0, id: key };
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, any>);

  const semaforoData = Object.values(incidenciasPorEstudiante).sort((a: any, b: any) => b.count - a.count);

  const kpis = [
    { label: "Estudiantes", value: totalEstudiantes, icon: Users, colorClass: "text-blue-400", bgClass: "bg-blue-500/15 border-blue-500/25" },
    { label: "Registros Hoy", value: todayRecords.length, icon: Activity, colorClass: "text-sky-400", bgClass: "bg-sky-500/15 border-sky-500/25" },
    { label: "Entradas", value: entradasHoy, icon: LogIn, colorClass: "text-emerald-400", bgClass: "bg-emerald-500/15 border-emerald-500/25" },
    { label: "Salidas", value: salidasHoy, icon: LogOut, colorClass: "text-red-400", bgClass: "bg-red-500/15 border-red-500/25" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Panel de Control</h1>
          <p className="text-slate-400 mt-0.5 text-sm">Monitoreo en tiempo real de entradas y salidas.</p>
        </div>
        <div className="glass-panel px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 self-start">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-400">En vivo</span>
        </div>
      </div>

      {/* Config Error */}
      {configError && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-amber-500/25 bg-amber-500/5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-amber-500/15 rounded-xl border border-amber-500/25">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-amber-400">Configuración Pendiente</h3>
              <p className="text-slate-400 mt-1 text-xs sm:text-sm">
                Conecta Supabase para empezar a registrar asistencias.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(({ label, value, icon: Icon, colorClass, bgClass }) => (
          <div key={label} className="glass-card p-4 sm:p-5 rounded-xl sm:rounded-2xl relative overflow-hidden group">
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">{label}</p>
                <h3 className={`text-2xl sm:text-3xl font-bold ${colorClass}`}>{value}</h3>
              </div>
              <div className={`p-2 sm:p-2.5 rounded-xl border ${bgClass}`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colorClass}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Realtime Feed */}
        <div className="lg:col-span-2 glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Actividad Reciente
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[400px] sm:max-h-[450px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full" />
                <p className="text-slate-500 text-sm">Cargando…</p>
              </div>
            ) : asistencias.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-sm">No hay registros recientes.</p>
            ) : (
              asistencias.map((a) => (
                <div key={a.id} className="glass-card p-3 sm:p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className={`p-1.5 sm:p-2 rounded-full border flex-shrink-0 ${
                      a.tipo === "ENTRADA" 
                        ? "bg-blue-500/15 border-blue-500/25 text-blue-400" 
                        : "bg-red-500/15 border-red-500/25 text-red-400"
                    }`}>
                      {a.tipo === "ENTRADA" ? <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-slate-200 text-xs sm:text-sm truncate">{a.estudiantes?.nombre_completo || "Desconocido"}</h4>
                      <p className="text-[10px] sm:text-xs text-slate-500">{a.estudiantes?.grado} &ldquo;{a.estudiantes?.seccion}&rdquo;</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:py-1 rounded-md ${
                      a.tipo === "ENTRADA" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                    }`}>{a.tipo}</span>
                    <p className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5">{a.fecha} · {a.hora}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Semáforo */}
        <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-1.5 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Semáforo Conductual
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 mb-3 sm:mb-4">Incidencias del mes en curso</p>
          <div className="flex gap-3 mb-3 sm:mb-4 text-[10px] sm:text-xs">
            <span className="text-emerald-400">🟢 ≤1</span>
            <span className="text-amber-400">🟡 2-3</span>
            <span className="text-red-400">🔴 &gt;3</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[350px] sm:max-h-[380px]">
            {semaforoData.length === 0 ? (
              <p className="text-slate-500 text-center py-8 text-sm">Sin datos este mes.</p>
            ) : (
              semaforoData.map((est: any, i: number) => {
                const { bg, emoji, label } = getSemaforoColor(est.count);
                return (
                  <div key={i} className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between ${bg}`}>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-base sm:text-lg">{emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{est.nombre_completo}</p>
                        <p className="text-[10px] sm:text-xs opacity-60">{est.grado} &ldquo;{est.seccion}&rdquo;</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-lg sm:text-xl font-bold">{est.count}</div>
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-60">{label}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
