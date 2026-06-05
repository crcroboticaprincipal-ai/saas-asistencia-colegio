"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import {
  Users, Activity, LogIn, LogOut, ShieldAlert, AlertCircle,
  Building2, Plus, X, Save, Loader2, CheckCircle, Globe, FileText, TrendingUp, ChevronDown
} from "lucide-react";

const cardSkeleton = () => <div className="animate-pulse h-32 rounded-2xl bg-slate-800/40" />;

const AusenciasAlertCard = dynamic(
  () => import("@/components/AusenciasAlertCard"),
  { loading: cardSkeleton, ssr: false }
);

const AlertasDesercionCard = dynamic(
  () => import("@/components/AlertasDesercionCard"),
  { loading: cardSkeleton, ssr: false }
);

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

type Institucion = {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  nivel_educativo: "basica" | "media" | "completa";
  plan_suscripcion: string;
  activo: boolean;
  created_at: string;
};

// ── Module-level cache for instituciones ──────────────────────────────────
let _cachedInstituciones: Institucion[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas
// ───────────────────────────────────────────────────────────────────────────

const NIVEL_LABELS: Record<string, string> = {
  basica: "Básica",
  media: "Media / Bachillerato",
  completa: "Completa (Básica + Media)",
};

const NIVEL_COLORS: Record<string, string> = {
  basica: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  media: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  completa: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export default function AdminDashboardPage() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  // Instituciones state
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [showInstModal, setShowInstModal] = useState(false);
  const [showInstituciones, setShowInstituciones] = useState(false);
  const [instForm, setInstForm] = useState({
    nombre: "",
    nombre_corto: "",
    nivel_educativo: "completa" as "basica" | "media" | "completa",
  });
  const [savingInst, setSavingInst] = useState(false);
  const [instError, setInstError] = useState("");
  const [instSuccess, setInstSuccess] = useState("");

  // Collapsible sections
  const [showSemaforo, setShowSemaforo] = useState(true);

  // Pases state
  const [pasesPeriod, setPasesPeriod] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [pasesStats, setPasesStats] = useState<{
    total: number;
    porTipo: { ENTRADA: number; SALIDA: number; ESPECIAL: number };
    ranking_mes: Array<{ estudiante_id: string; nombre: string; grado: string; seccion: string; foto_url: string | null; total: number; alerta: boolean }>;
  } | null>(null);
  const [loadingPases, setLoadingPases] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    fetchInitialData();
    fetchTotalEstudiantes();
    fetchInstituciones();
    fetchPasesStats('dia');

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

  const fetchInstituciones = async () => {
    // SWR-style cache: skip network call if data is still fresh
    if (_cachedInstituciones !== null && Date.now() - _cacheTimestamp < CACHE_TTL) {
      setInstituciones(_cachedInstituciones);
      setLoadingInst(false);
      return;
    }
    setLoadingInst(true);
    try {
      const res = await fetch("/api/admin/instituciones");
      const { data } = await res.json();
      if (data) {
        _cachedInstituciones = data as Institucion[];
        _cacheTimestamp = Date.now();
        setInstituciones(_cachedInstituciones);
      }
    } catch (e) {
      console.error("Error cargando instituciones:", e);
    } finally {
      setLoadingInst(false);
    }
  };

  const fetchPasesStats = async (period: 'dia' | 'semana' | 'mes') => {
    setLoadingPases(true);
    try {
      const res = await fetch(`/api/pases/stats?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setPasesStats(data);
      }
    } catch { /* silencioso */ } finally {
      setLoadingPases(false);
    }
  };

  const handleCrearInstitucion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInst(true);
    setInstError("");

    try {
      const res = await fetch("/api/admin/instituciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar institución");

      setInstSuccess(`Institución "${instForm.nombre}" creada exitosamente.`);
      setShowInstModal(false);
      setInstForm({ nombre: "", nombre_corto: "", nivel_educativo: "completa" });
      fetchInstituciones();
      setTimeout(() => setInstSuccess(""), 4000);
    } catch (err: unknown) {
      setInstError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSavingInst(false);
    }
  };

  const getSemaforoColor = (incidencias: number) => {
    if (incidencias <= 1) return { bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", emoji: "🟢", label: "Regular" };
    if (incidencias <= 3) return { bg: "bg-amber-500/15 text-amber-400 border-amber-500/25", emoji: "🟡", label: "Atención" };
    return { bg: "bg-red-500/15 text-red-400 border-red-500/25", emoji: "🔴", label: "Crítico" };
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecords = asistencias.filter((a) => a.fecha === todayStr);
  const entradasHoy = todayRecords.filter((a) => a.tipo === "ENTRADA").length;
  const salidasHoy = todayRecords.filter((a) => a.tipo === "SALIDA").length;

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
              <p className="text-slate-400 mt-1 text-xs sm:text-sm">Conecta Supabase para empezar a registrar asistencias.</p>
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

      {/* ── ALERTA DE AUSENCIAS CRÍTICAS ── */}
      <AusenciasAlertCard />

      {/* ── PANEL DE ALERTA TEMPRANA DE DESERCIÓN ── */}
      <AlertasDesercionCard />

      {/* ── ANALYTICS DE PASES & CONDUCTA ── */}
      <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-semibold text-white">Pases Digitales & Conducta</h2>
            <span className="ml-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">Tiempo real</span>
          </div>
          <div className="flex gap-2">
            {(['dia', 'semana', 'mes'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPasesPeriod(p); fetchPasesStats(p); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  pasesPeriod === p
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        {loadingPases ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : pasesStats ? (
          <div className="space-y-4">
            {/* KPIs de pases */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Pases', value: pasesStats.total, color: 'text-amber-400', icon: '📋' },
                { label: 'Entrada', value: pasesStats.porTipo.ENTRADA, color: 'text-blue-400', icon: '🚪' },
                { label: 'Salida', value: pasesStats.porTipo.SALIDA, color: 'text-rose-400', icon: '🚶' },
                { label: 'Especial', value: pasesStats.porTipo.ESPECIAL, color: 'text-violet-400', icon: '⭐' },
              ].map((k) => (
                <div key={k.label} className="glass-card p-3 rounded-xl text-center">
                  <p className="text-2xl mb-0.5">{k.icon}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-slate-500 text-xs">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Ranking conductual del mes */}
            {pasesStats.ranking_mes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-rose-400" />
                  <p className="text-sm font-semibold text-white">Alumnos con Mayor Acumulación (Mes)</p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {pasesStats.ranking_mes.map((est) => (
                    <div key={est.estudiante_id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      est.alerta
                        ? 'bg-rose-500/10 border-rose-500/25 animate-pulse'
                        : 'bg-slate-800/30 border-white/5'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{est.alerta ? '🚨' : '📋'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{est.nombre}</p>
                          <p className="text-xs text-slate-500">{est.grado} &ldquo;{est.seccion}&rdquo;</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className={`text-xl font-bold ${est.alerta ? 'text-rose-400' : 'text-amber-400'}`}>{est.total}</p>
                        {est.alerta && <p className="text-[9px] text-rose-400 font-semibold uppercase">⚠️ Seguimiento</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No hay pases registrados en este período.</p>
        )}
      </div>

      {/* ── GESTIÓN DE INSTITUCIONES (Multi-tenant) ── */}
      <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowInstituciones((v) => !v)}
            className="flex items-center gap-2 group"
            aria-expanded={showInstituciones}
          >
            <Building2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-base sm:text-lg font-semibold text-white">Instituciones Registradas</h2>
            <span className="ml-1 text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-medium">
              Multi-tenant
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                showInstituciones ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={() => { setInstError(""); setInstForm({ nombre: "", nombre_corto: "", nivel_educativo: "completa" }); setShowInstModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Institución
          </button>
        </div>

        {/* Compact summary when collapsed */}
        {!showInstituciones && !loadingInst && (
          <p className="text-sm text-slate-400">
            {instituciones.length === 0
              ? "No hay instituciones registradas."
              : `${instituciones.length} institución(es) registrada(s)`}
          </p>
        )}

        {instSuccess && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {instSuccess}
          </div>
        )}

        {showInstituciones && (
          loadingInst ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : instituciones.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay instituciones registradas.</p>
              <p className="text-xs mt-1">Crea la primera institución con el botón &quot;Nueva Institución&quot;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {instituciones.map((inst) => (
                <div key={inst.id} className="glass-card p-4 rounded-xl border border-white/[0.06] flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{inst.nombre}</p>
                      {inst.nombre_corto && (
                        <p className="text-slate-500 text-xs font-mono">@{inst.nombre_corto}</p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      inst.activo
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : "bg-slate-500/15 text-slate-400 border-slate-500/25"
                    }`}>
                      {inst.activo ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium self-start ${NIVEL_COLORS[inst.nivel_educativo] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                    {NIVEL_LABELS[inst.nivel_educativo] || inst.nivel_educativo}
                  </span>
                  <p className="text-[10px] text-slate-600 mt-auto pt-1">
                    Plan: <span className="capitalize text-slate-500">{inst.plan_suscripcion}</span>
                  </p>
                </div>
              ))}
            </div>
          )
        )}
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
          <button
            onClick={() => setShowSemaforo((v) => !v)}
            className="flex items-center gap-2 mb-1.5 w-full text-left"
            aria-expanded={showSemaforo}
          >
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-semibold text-white">Semáforo Conductual</h2>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 ml-auto transition-transform duration-200 ${
                showSemaforo ? "rotate-180" : ""
              }`}
            />
          </button>
          <p className="text-[10px] sm:text-xs text-slate-500 mb-3 sm:mb-4">Incidencias del mes en curso</p>

          {showSemaforo && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: Registrar Nueva Institución ── */}
      {showInstModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">Registrar Nueva Institución</h2>
              </div>
              <button
                onClick={() => setShowInstModal(false)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {instError && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {instError}
              </div>
            )}

            <form onSubmit={handleCrearInstitucion} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nombre de la Institución <span className="text-rose-400">*</span>
                </label>
                <input
                  id="inst-nombre"
                  required
                  type="text"
                  placeholder="ej: UE Colegio Rafael Castillo"
                  value={instForm.nombre}
                  onChange={(e) => setInstForm({ ...instForm, nombre: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nombre Corto / Siglas
                  <span className="text-slate-600 ml-1">(opcional)</span>
                </label>
                <input
                  id="inst-nombre-corto"
                  type="text"
                  placeholder="ej: CRC"
                  value={instForm.nombre_corto}
                  onChange={(e) => setInstForm({ ...instForm, nombre_corto: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm font-mono"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nivel Educativo <span className="text-rose-400">*</span>
                </label>
                <select
                  id="inst-nivel"
                  required
                  value={instForm.nivel_educativo}
                  onChange={(e) => setInstForm({ ...instForm, nivel_educativo: e.target.value as typeof instForm.nivel_educativo })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                >
                  <option value="basica">Básica (1° – 6° grado)</option>
                  <option value="media">Media / Bachillerato (7° – 11°)</option>
                  <option value="completa">Completa (Básica + Media)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowInstModal(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  id="btn-guardar-institucion"
                  type="submit"
                  disabled={savingInst}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-all text-sm disabled:opacity-50 shadow-lg shadow-violet-500/20"
                >
                  {savingInst
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><Save className="w-4 h-4" /> Registrar Institución</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
