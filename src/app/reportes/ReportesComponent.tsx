"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Download, Calendar, Users, Clock, AlertTriangle, TrendingUp,
  Search, User, FileText, BarChart2, Loader2
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

type AsistenciaRow = {
  id: string;
  estudiante_id: string;
  tipo: "ENTRADA" | "SALIDA";
  fecha: string;
  hora: string;
  metodo?: string;
  estudiantes: {
    cedula: string;
    nombre_completo: string;
    grado: string;
    seccion: string;
  };
};

type TabId = "resumen" | "individual" | "grupal";

// ── Helpers ──────────────────────────────────────────────────────────────────

const getCaracasDate = (date: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);

const parseTimeMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportesComponent() {
  // Shared data
  const [allData, setAllData] = useState<AsistenciaRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  // Resumen filters
  const [filtroTiempo, setFiltroTiempo] = useState("HOY");
  const [horaOficialEntrada, setHoraOficialEntrada] = useState("07:00");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Individual state
  const [busquedaInd, setBusquedaInd] = useState("");
  const [loadingInd, setLoadingInd] = useState(false);
  const [historialInd, setHistorialInd] = useState<AsistenciaRow[]>([]);
  const [estudianteInfo, setEstudianteInfo] = useState<AsistenciaRow["estudiantes"] | null>(null);
  const [desdeInd, setDesdeInd] = useState("");
  const [hastaInd, setHastaInd] = useState("");

  // Grupal state
  const [gradoFiltro, setGradoFiltro] = useState("");
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [loadingGrupal, setLoadingGrupal] = useState(false);
  const [grupalData, setGrupalData] = useState<AsistenciaRow[]>([]);
  const [desdeGrupal, setDesdeGrupal] = useState("");
  const [hastaGrupal, setHastaGrupal] = useState("");

  // ── Fetch full dataset for Resumen tab ──────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("asistencias")
      .select(`id, estudiante_id, tipo, fecha, hora, metodo,
        estudiantes (cedula, nombre_completo, grado, seccion)`)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false });

    if (data && !error) {
      setAllData(data as unknown as AsistenciaRow[]);
    }
    setLoading(false);
  };

  // ── Resumen tab filtering ───────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let result = allData;
    const today = new Date();
    const todayStr = getCaracasDate(today);

    if (filtroTiempo === "HOY") {
      result = result.filter((a) => a.fecha === todayStr);
    } else if (filtroTiempo === "SEMANA") {
      const weekAgoStr = getCaracasDate(new Date(today.getTime() - 7 * 86400000));
      result = result.filter((a) => a.fecha >= weekAgoStr);
    } else if (filtroTiempo === "MES") {
      const monthAgoStr = getCaracasDate(new Date(today.getTime() - 30 * 86400000));
      result = result.filter((a) => a.fecha >= monthAgoStr);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.estudiantes?.nombre_completo?.toLowerCase().includes(s) ||
          a.estudiantes?.cedula?.toLowerCase().includes(s) ||
          a.estudiantes?.grado?.toLowerCase().includes(s) ||
          a.estudiantes?.seccion?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [filtroTiempo, search, allData]);

  const { totalEntradas, minutosRetardoTotales, promedioHoraLlegada, chartData } = useMemo(() => {
    let entradas = 0;
    let retardosAcumulados = 0;
    let totalMinutosLlegada = 0;
    const officialMinutes = parseTimeMinutes(horaOficialEntrada);
    const entradasPorDia: Record<string, number> = {};

    filteredData.forEach((a) => {
      if (a.tipo === "ENTRADA") {
        entradas++;
        entradasPorDia[a.fecha] = (entradasPorDia[a.fecha] || 0) + 1;
        const entryMinutes = parseTimeMinutes(a.hora);
        totalMinutosLlegada += entryMinutes;
        const retardo = entryMinutes - officialMinutes;
        if (retardo > 0) retardosAcumulados += retardo;
      }
    });

    let promedioStr = "--:--";
    if (entradas > 0) {
      const prom = Math.floor(totalMinutosLlegada / entradas);
      promedioStr = `${String(Math.floor(prom / 60)).padStart(2, "0")}:${String(prom % 60).padStart(2, "0")}`;
    }

    const chart = Object.keys(entradasPorDia)
      .sort()
      .map((date) => {
        const [, m, d] = date.split("-");
        return { name: `${d}/${m}`, Entradas: entradasPorDia[date] };
      });

    return { totalEntradas: entradas, minutosRetardoTotales: retardosAcumulados, promedioHoraLlegada: promedioStr, chartData: chart };
  }, [filteredData, horaOficialEntrada]);

  // ── Individual tab ──────────────────────────────────────────────────────────
  const buscarIndividual = useCallback(async () => {
    const term = busquedaInd.trim();
    if (!term) return;
    setLoadingInd(true);
    setHistorialInd([]);
    setEstudianteInfo(null);

    try {
      // Find student
      const { data: est } = await supabase
        .from("estudiantes")
        .select("id, cedula, nombre_completo, grado, seccion")
        .or(`cedula.eq.${term},nombre_completo.ilike.%${term}%`)
        .limit(1)
        .maybeSingle();

      if (!est) {
        alert("No se encontró ningún estudiante con esa cédula o nombre.");
        return;
      }

      setEstudianteInfo({
        cedula: est.cedula,
        nombre_completo: est.nombre_completo,
        grado: est.grado,
        seccion: est.seccion,
      });

      // Fetch their attendance
      let query = supabase
        .from("asistencias")
        .select("id, estudiante_id, tipo, fecha, hora, metodo, estudiantes(cedula, nombre_completo, grado, seccion)")
        .eq("estudiante_id", est.id)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (desdeInd) query = query.gte("fecha", desdeInd);
      if (hastaInd) query = query.lte("fecha", hastaInd);

      const { data: asis } = await query;
      setHistorialInd((asis as unknown as AsistenciaRow[]) || []);
    } finally {
      setLoadingInd(false);
    }
  }, [busquedaInd, desdeInd, hastaInd]);

  const exportarIndividualExcel = async () => {
    if (historialInd.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: historialInd, horaOficialEntrada }),
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asisto_${estudianteInfo?.cedula || "Individual"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Error al descargar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Grupal tab ──────────────────────────────────────────────────────────────
  const buscarGrupal = useCallback(async () => {
    if (!gradoFiltro && !seccionFiltro) {
      alert("Selecciona al menos un Año o una Sección.");
      return;
    }
    setLoadingGrupal(true);
    setGrupalData([]);

    try {
      let query = supabase
        .from("asistencias")
        .select("id, estudiante_id, tipo, fecha, hora, metodo, estudiantes(cedula, nombre_completo, grado, seccion)")
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (desdeGrupal) query = query.gte("fecha", desdeGrupal);
      if (hastaGrupal) query = query.lte("fecha", hastaGrupal);

      const { data } = await query;
      let rows = (data as unknown as AsistenciaRow[]) || [];

      // Filter client-side by grado/seccion
      if (gradoFiltro) rows = rows.filter((r) => r.estudiantes?.grado?.toLowerCase().includes(gradoFiltro.toLowerCase()));
      if (seccionFiltro) rows = rows.filter((r) => r.estudiantes?.seccion?.toLowerCase().includes(seccionFiltro.toLowerCase()));

      setGrupalData(rows);
    } finally {
      setLoadingGrupal(false);
    }
  }, [gradoFiltro, seccionFiltro, desdeGrupal, hastaGrupal]);

  const exportarGrupalExcel = async () => {
    if (grupalData.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: grupalData, horaOficialEntrada }),
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asisto_Seccion_${gradoFiltro}_${seccionFiltro}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Error al descargar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Grupal matrix ──────────────────────────────────────────────────────────
  const grupalMatrix = useMemo(() => {
    if (grupalData.length === 0) return { students: [], dates: [], matrix: {} };

    const officialMinutes = parseTimeMinutes(horaOficialEntrada);

    // Build unique students and dates
    const studentsMap: Record<string, { cedula: string; nombre: string; grado: string; seccion: string }> = {};
    const datesSet = new Set<string>();

    grupalData.forEach((r) => {
      if (r.tipo === "ENTRADA") {
        studentsMap[r.estudiante_id] = {
          cedula: r.estudiantes?.cedula,
          nombre: r.estudiantes?.nombre_completo,
          grado: r.estudiantes?.grado,
          seccion: r.estudiantes?.seccion,
        };
        datesSet.add(r.fecha);
      }
    });

    const students = Object.entries(studentsMap).map(([id, info]) => ({ id, ...info }));
    const dates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

    // Build matrix: estudiante_id → fecha → { entrada?, retardo }
    const matrix: Record<string, Record<string, { hora: string; retardo: boolean }>> = {};

    grupalData.forEach((r) => {
      if (r.tipo !== "ENTRADA") return;
      if (!matrix[r.estudiante_id]) matrix[r.estudiante_id] = {};
      const mins = parseTimeMinutes(r.hora);
      matrix[r.estudiante_id][r.fecha] = {
        hora: r.hora,
        retardo: mins > officialMinutes + 10,
      };
    });

    return { students, dates, matrix };
  }, [grupalData, horaOficialEntrada]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "resumen", label: "📊 Resumen", icon: <BarChart2 className="w-4 h-4" /> },
    { id: "individual", label: "👤 Individual", icon: <User className="w-4 h-4" /> },
    { id: "grupal", label: "🏫 Por Sección", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-indigo-600" />
            Asisto Analytics
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Inteligencia y reportes dinámicos de asistencia.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl w-full sm:w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ───────────────────────────────────────────────────── */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Rango de Tiempo</label>
              <select
                value={filtroTiempo}
                onChange={(e) => setFiltroTiempo(e.target.value)}
                className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-sm"
              >
                <option value="HOY">Hoy</option>
                <option value="SEMANA">Esta Semana</option>
                <option value="MES">Últimos 30 Días</option>
                <option value="TODOS">Histórico Completo</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Hora Oficial Entrada</label>
              <input
                type="time"
                value={horaOficialEntrada}
                onChange={(e) => setHoraOficialEntrada(e.target.value)}
                className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Buscar Alumno o Sección</label>
              <input
                type="text"
                placeholder="Cédula, Nombre o Sección..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={async () => {
                  if (filteredData.length === 0) return;
                  setIsExporting(true);
                  try {
                    const res = await fetch("/api/exportar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ data: filteredData, horaOficialEntrada }),
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Asisto_Reporte_${filtroTiempo}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } catch { alert("Error al exportar."); }
                  finally { setIsExporting(false); }
                }}
                disabled={isExporting || filteredData.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 text-sm disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exportar Excel
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { label: "Total Entradas", value: totalEntradas, icon: Users, color: "text-emerald-600", note: "Asistencias registradas" },
              { label: "Promedio Hora Llegada", value: promedioHoraLlegada, icon: Clock, color: "text-indigo-600", note: "Tiempo medio de ingreso" },
              { label: "Retardos Acumulados", value: `${minutosRetardoTotales} min`, icon: AlertTriangle, color: "text-rose-600", note: `Minutos después de las ${horaOficialEntrada}` },
            ].map((kpi) => (
              <div key={kpi.label} className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <kpi.icon className={`w-16 h-16 ${kpi.color}`} />
                </div>
                <p className="text-slate-500 text-sm font-medium mb-1">{kpi.label}</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{loading ? "—" : kpi.value}</h3>
                <p className={`${kpi.color} text-xs mt-2 font-medium`}>{kpi.note}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Tendencia de Ingresos</h2>
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400">No hay datos para graficar</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px" }} itemStyle={{ color: "#4f46e5", fontWeight: "bold" }} />
                    <Bar dataKey="Entradas" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: INDIVIDUAL ────────────────────────────────────────────────── */}
      {activeTab === "individual" && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Historial por Estudiante</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Cédula o nombre completo..."
                value={busquedaInd}
                onChange={(e) => setBusquedaInd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarIndividual()}
                className="flex-1 min-w-[200px] bg-slate-100/60 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
              <div className="flex gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Desde</label>
                  <input type="date" value={desdeInd} onChange={(e) => setDesdeInd(e.target.value)}
                    className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Hasta</label>
                  <input type="date" value={hastaInd} onChange={(e) => setHastaInd(e.target.value)}
                    className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none" />
                </div>
              </div>
              <button
                onClick={buscarIndividual}
                disabled={!busquedaInd.trim() || loadingInd}
                className="self-end px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {loadingInd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </div>
          </div>

          {/* Results */}
          {estudianteInfo && (
            <div className="space-y-4">
              {/* Student header */}
              <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Estudiante encontrado</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{estudianteInfo.nombre_completo}</h3>
                  <p className="text-sm text-slate-500">C.I. {estudianteInfo.cedula} · {estudianteInfo.grado} &ldquo;{estudianteInfo.seccion}&rdquo; · {historialInd.length} registros</p>
                </div>
                <button
                  onClick={exportarIndividualExcel}
                  disabled={isExporting || historialInd.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Exportar Excel
                </button>
              </div>

              {/* KPIs individuales */}
              {(() => {
                const entradas = historialInd.filter((a) => a.tipo === "ENTRADA");
                const salidas = historialInd.filter((a) => a.tipo === "SALIDA");
                const officialMins = parseTimeMinutes(horaOficialEntrada);
                const retardos = entradas.filter((a) => parseTimeMinutes(a.hora) > officialMins + 10);
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="glass-panel p-4 rounded-xl text-center">
                      <p className="text-2xl font-bold text-emerald-500">{entradas.length}</p>
                      <p className="text-xs text-slate-500 mt-1">Entradas</p>
                    </div>
                    <div className="glass-panel p-4 rounded-xl text-center">
                      <p className="text-2xl font-bold text-blue-400">{salidas.length}</p>
                      <p className="text-xs text-slate-500 mt-1">Salidas</p>
                    </div>
                    <div className="glass-panel p-4 rounded-xl text-center">
                      <p className="text-2xl font-bold text-amber-400">{retardos.length}</p>
                      <p className="text-xs text-slate-500 mt-1">Retardos</p>
                    </div>
                  </div>
                );
              })()}

              {/* Historial table */}
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-white/[0.06]">
                      <tr className="text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Hora</th>
                        <th className="py-3 px-4">Movimiento</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4">Método</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {historialInd.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sin registros para este periodo.</td></tr>
                      ) : (
                        historialInd.map((a) => {
                          const officialMins = parseTimeMinutes(horaOficialEntrada);
                          const retardo = a.tipo === "ENTRADA" && parseTimeMinutes(a.hora) > officialMins + 10;
                          return (
                            <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors text-slate-700 dark:text-slate-300">
                              <td className="py-3 px-4 font-medium">{a.fecha}</td>
                              <td className="py-3 px-4 font-mono">{a.hora.substring(0, 5)}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  a.tipo === "ENTRADA"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                }`}>
                                  {a.tipo === "ENTRADA" ? "↗ Entrada" : "↙ Salida"}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {a.tipo === "ENTRADA"
                                  ? retardo
                                    ? <span className="text-amber-500 font-semibold">⚠️ Retardo</span>
                                    : <span className="text-emerald-500 font-semibold">✓ Puntual</span>
                                  : <span className="text-slate-400">Egreso</span>}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/[0.06] font-mono text-[10px] text-slate-500 uppercase">
                                  {a.metodo || "QR"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!estudianteInfo && !loadingInd && (
            <div className="glass-panel p-12 rounded-2xl text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Busca un estudiante</p>
              <p className="text-sm mt-1">Ingresa la cédula o nombre y presiona Buscar.</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: GRUPAL ────────────────────────────────────────────────────── */}
      {activeTab === "grupal" && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Auditoría por Sección</h2>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Año / Grado</label>
                <input
                  type="text"
                  placeholder="Ej: 3er Año"
                  value={gradoFiltro}
                  onChange={(e) => setGradoFiltro(e.target.value)}
                  className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Sección</label>
                <input
                  type="text"
                  placeholder="Ej: A"
                  value={seccionFiltro}
                  onChange={(e) => setSeccionFiltro(e.target.value)}
                  className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 w-24"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Desde</label>
                <input type="date" value={desdeGrupal} onChange={(e) => setDesdeGrupal(e.target.value)}
                  className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Hasta</label>
                <input type="date" value={hastaGrupal} onChange={(e) => setHastaGrupal(e.target.value)}
                  className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Hora Oficial</label>
                <input type="time" value={horaOficialEntrada} onChange={(e) => setHoraOficialEntrada(e.target.value)}
                  className="bg-slate-100/60 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none" />
              </div>
              <button
                onClick={buscarGrupal}
                disabled={loadingGrupal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {loadingGrupal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Consultar
              </button>
            </div>
          </div>

          {/* Grupal results */}
          {grupalData.length > 0 && (
            <div className="space-y-4">
              {/* KPIs grupales */}
              {(() => {
                const officialMins = parseTimeMinutes(horaOficialEntrada);
                const entradas = grupalData.filter((r) => r.tipo === "ENTRADA");
                const uniqueStudents = new Set(entradas.map((r) => r.estudiante_id)).size;
                const retardos = entradas.filter((r) => parseTimeMinutes(r.hora) > officialMins + 10).length;
                const diasClase = new Set(entradas.map((r) => r.fecha)).size;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Estudiantes", value: uniqueStudents, color: "text-indigo-500" },
                      { label: "Total Entradas", value: entradas.length, color: "text-emerald-500" },
                      { label: "Retardos", value: retardos, color: "text-amber-500" },
                      { label: "Días con Clase", value: diasClase, color: "text-blue-400" },
                    ].map((k) => (
                      <div key={k.label} className="glass-panel p-4 rounded-xl text-center">
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{k.label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Export */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{grupalMatrix.dates.length} fechas · {grupalMatrix.students.length} estudiantes</p>
                <button
                  onClick={exportarGrupalExcel}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Exportar Sección Excel
                </button>
              </div>

              {/* Attendance Matrix Table */}
              <div className="glass-panel rounded-2xl overflow-auto max-h-[70vh]">
                <table className="min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-800">
                    <tr>
                      <th className="py-3 px-4 text-left text-slate-300 font-semibold min-w-[180px] sticky left-0 bg-slate-800 z-20">
                        Estudiante
                      </th>
                      {grupalMatrix.dates.map((d) => {
                        const [, m, day] = d.split("-");
                        return (
                          <th key={d} className="py-3 px-2 text-center text-slate-400 font-mono font-medium whitespace-nowrap">
                            {day}/{m}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {grupalMatrix.students.map((st) => (
                      <tr key={st.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 sticky left-0 bg-slate-950/80 backdrop-blur z-10">
                          <p className="font-medium text-slate-200 truncate max-w-[160px]">{st.nombre}</p>
                          <p className="text-[10px] text-slate-500">{st.cedula}</p>
                        </td>
                        {grupalMatrix.dates.map((d) => {
                          const cell = grupalMatrix.matrix[st.id]?.[d];
                          return (
                            <td key={d} className="py-2.5 px-2 text-center">
                              {cell ? (
                                <span
                                  title={`${cell.hora}${cell.retardo ? " — Retardo" : " — Puntual"}`}
                                  className={`inline-block w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                    cell.retardo
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  }`}
                                >
                                  {cell.retardo ? "R" : "✓"}
                                </span>
                              ) : (
                                <span className="inline-block w-6 h-6 rounded-full bg-slate-800/60 border border-white/[0.04] text-slate-600 flex items-center justify-center text-[10px]">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[9px]">✓</span>
                  Puntual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-[9px]">R</span>
                  Retardo ({">"}10 min)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-800/60 border border-white/[0.04] flex items-center justify-center text-slate-600 text-[9px]">—</span>
                  Sin registro
                </span>
              </div>
            </div>
          )}

          {grupalData.length === 0 && !loadingGrupal && (
            <div className="glass-panel p-12 rounded-2xl text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Selecciona un Año y/o Sección</p>
              <p className="text-sm mt-1">Filtra por grado y sección, define el rango de fechas y presiona Consultar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
