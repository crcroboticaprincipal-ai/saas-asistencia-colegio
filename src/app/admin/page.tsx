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
    if (incidencias <= 1) return { bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "🟢", label: "Regular" };
    if (incidencias <= 3) return { bg: "bg-amber-500/20 text-amber-400 border-amber-500/30", emoji: "🟡", label: "Atención" };
    return { bg: "bg-rose-500/20 text-rose-400 border-rose-500/30", emoji: "🔴", label: "Crítico" };
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Panel de Control</h1>
          <p className="text-slate-400 mt-1">Monitoreo en tiempo real de entradas y salidas.</p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium text-emerald-400">Tiempo Real</span>
        </div>
      </div>

      {/* Config Error */}
      {configError && (
        <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/30">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-400">Configuración Pendiente</h3>
              <p className="text-slate-400 mt-1">
                Crea un archivo <code className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300 text-sm">.env.local</code> con las variables de Supabase y Resend.
              </p>
              <pre className="mt-3 bg-slate-800/80 rounded-xl p-4 text-sm text-slate-300 overflow-x-auto border border-white/5">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
ADMIN_PASSWORD=tu_contraseña_segura`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Estudiantes", value: totalEstudiantes, icon: Users, color: "indigo" },
          { label: "Registros Hoy", value: todayRecords.length, icon: Activity, color: "cyan" },
          { label: "Entradas", value: entradasHoy, icon: LogIn, color: "emerald" },
          { label: "Salidas", value: salidasHoy, icon: LogOut, color: "rose" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-5 rounded-2xl relative overflow-hidden group">
            <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className={`text-xs font-medium text-${color === "indigo" || color === "cyan" ? "slate" : color}-400${color === "indigo" || color === "cyan" ? "" : "/70"} mb-1 uppercase tracking-wide`}>{label}</p>
                <h3 className={`text-3xl font-bold text-${color === "indigo" || color === "cyan" ? "white" : color + "-400"}`}>{value}</h3>
              </div>
              <div className={`p-2.5 bg-${color}-500/20 rounded-xl border border-${color}-500/30`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Realtime Feed */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Actividad Reciente
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 max-h-[450px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full" />
                <p className="text-slate-500 text-sm">Cargando…</p>
              </div>
            ) : asistencias.length === 0 ? (
              <p className="text-slate-500 text-center py-12 text-sm">No hay registros recientes.</p>
            ) : (
              asistencias.map((a) => (
                <div key={a.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full border ${a.tipo === "ENTRADA" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/30 text-rose-400"}`}>
                      {a.tipo === "ENTRADA" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200 text-sm">{a.estudiantes?.nombre_completo || "Desconocido"}</h4>
                      <p className="text-xs text-slate-500">{a.estudiantes?.grado} &ldquo;{a.estudiantes?.seccion}&rdquo;</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${a.tipo === "ENTRADA" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{a.tipo}</span>
                    <p className="text-[11px] text-slate-500 mt-1">{a.fecha} · {a.hora}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Semáforo */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            Semáforo Conductual
          </h2>
          <p className="text-xs text-slate-500 mb-4">Incidencias del mes en curso</p>
          <div className="flex gap-3 mb-4 text-xs">
            <span className="text-emerald-400">🟢 ≤1</span>
            <span className="text-amber-400">🟡 2-3</span>
            <span className="text-rose-400">🔴 &gt;3</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[380px]">
            {semaforoData.length === 0 ? (
              <p className="text-slate-500 text-center py-8 text-sm">Sin datos este mes.</p>
            ) : (
              semaforoData.map((est: any, i: number) => {
                const { bg, emoji, label } = getSemaforoColor(est.count);
                return (
                  <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${bg}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{est.nombre_completo}</p>
                        <p className="text-xs opacity-60">{est.grado} &ldquo;{est.seccion}&rdquo;</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{est.count}</div>
                      <p className="text-[10px] uppercase tracking-wider opacity-60">{label}</p>
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
