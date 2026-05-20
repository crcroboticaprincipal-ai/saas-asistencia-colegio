"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from "recharts";
import {
  BookOpen, TrendingUp, Users, AlertTriangle, Download, Loader2, Filter
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface DataMateria {
  nombre: string;
  grado: string;
  seccion: string;
  presentes: number;
  ausentes: number;
  porcentaje: number;
}

interface FugaInterna {
  nombre_completo: string;
  grado: string;
  seccion: string;
  entro_colegio: boolean;
  ausente_en: string[];
}

export default function AnaliticaMateriasComponent() {
  const [loading, setLoading] = useState(true);
  const [dataClases, setDataClases] = useState<DataMateria[]>([]);
  const [filtroGrado, setFiltroGrado] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [fechaFin, setFechaFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asistencia_materia")
        .select(`
          estado,
          fecha,
          asignacion:profesores_asignaciones(
            grado, seccion,
            materia:materias(nombre)
          )
        `)
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);

      if (error || !data) throw error;

      // Agrupar por materia-sección
      const agrupado: Record<string, { presente: number; total: number; grado: string; seccion: string }> = {};

      data.forEach((r: Record<string, unknown>) => {
        const asig = r.asignacion as Record<string, unknown> | null;
        const materia = asig?.materia as Record<string, unknown> | null;
        const nombre = (materia?.nombre as string) || "Sin materia";
        const grado = (asig?.grado as string) || "";
        const seccion = (asig?.seccion as string) || "";
        const clave = `${nombre}|${grado}|${seccion}`;

        if (!agrupado[clave]) agrupado[clave] = { presente: 0, total: 0, grado, seccion };
        agrupado[clave].total++;
        if (r.estado === "Presente") agrupado[clave].presente++;
      });

      const resultado: DataMateria[] = Object.entries(agrupado).map(([clave, val]) => {
        const [nombre, grado, seccion] = clave.split("|");
        return {
          nombre,
          grado,
          seccion,
          presentes: val.presente,
          ausentes: val.total - val.presente,
          porcentaje: val.total > 0 ? Math.round((val.presente / val.total) * 100) : 0,
        };
      }).sort((a, b) => b.porcentaje - a.porcentaje);

      setDataClases(resultado);
    } catch {
      setDataClases([]);
    } finally {
      setLoading(false);
    }
  };

  const grados = useMemo(() => {
    const set = new Set(dataClases.map((d) => d.grado));
    return ["todos", ...Array.from(set)];
  }, [dataClases]);

  const filtrado = useMemo(() => {
    return filtroGrado === "todos" ? dataClases : dataClases.filter((d) => d.grado === filtroGrado);
  }, [dataClases, filtroGrado]);

  const mejorSeccion = filtrado.reduce((best, d) => d.porcentaje > (best?.porcentaje ?? 0) ? d : best, filtrado[0]);
  const peorSeccion = filtrado.reduce((worst, d) => d.porcentaje < (worst?.porcentaje ?? 100) ? d : worst, filtrado[0]);
  const totalPresentes = filtrado.reduce((s, d) => s + d.presentes, 0);
  const totalAusentes = filtrado.reduce((s, d) => s + d.ausentes, 0);

  const pieData = [
    { name: "Presentes", value: totalPresentes },
    { name: "Ausencias", value: totalAusentes },
  ];

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/exportar/institucional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "materias", fechaInicio, fechaFin, data: filtrado }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asisto_Analitica_Materias_${fechaFin}.xlsx`;
      a.click();
      a.remove();
    } catch {
      alert("Error al exportar");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            Analítica por Materia
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Detección de fugas internas · Ranking de secciones</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={isExporting || filtrado.length === 0}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all text-sm disabled:opacity-50 w-full sm:w-auto justify-center"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      {/* Filtros */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 [color-scheme:dark]" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Grado</label>
          <select value={filtroGrado} onChange={(e) => setFiltroGrado(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
            {grados.map((g) => <option key={g} value={g}>{g === "todos" ? "Todos los grados" : g}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm flex items-center gap-1.5 transition-all">
          <Filter className="w-4 h-4" /> Filtrar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-indigo-400 animate-spin" /></div>
      ) : filtrado.length === 0 ? (
        <div className="glass-panel rounded-2xl flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-16 h-16 text-slate-700 mb-4" />
          <p className="text-slate-400">No hay datos de asistencia por materia en este período</p>
          <p className="text-slate-600 text-sm mt-1">Usa el Terminal del Docente para registrar asistencias en el aula</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Clases Registradas", value: filtrado.length, icon: "📚", color: "text-white" },
              { label: "Presencias totales", value: totalPresentes, icon: "✅", color: "text-emerald-400" },
              { label: "Ausencias totales", value: totalAusentes, icon: "🚨", color: "text-rose-400" },
              { label: "Mejor Sección", value: mejorSeccion ? `${mejorSeccion.grado} "${mejorSeccion.seccion}"` : "—", icon: "🏆", color: "text-amber-400" },
            ].map((k) => (
              <div key={k.label} className="glass-panel p-4 rounded-2xl">
                <p className="text-xl mb-1">{k.icon}</p>
                <p className={`text-xl font-bold ${k.color} truncate`}>{k.value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de barras ranking */}
            <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" /> Ranking de Asistencia por Clase
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filtrado.slice(0, 10)} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey={(d) => `${d.nombre} ${d.grado}"${d.seccion}"`} tick={{ fill: "#94a3b8", fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#f1f5f9" }}
                    formatter={(v) => [`${v}%`, "Asistencia"]}
                  />
                  <Bar dataKey="porcentaje" radius={[0, 6, 6, 0]}>
                    {filtrado.slice(0, 10).map((entry, i) => (
                      <Cell key={i} fill={entry.porcentaje >= 90 ? "#10b981" : entry.porcentaje >= 70 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart presencias vs ausencias */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Presencia Global
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#10b981" : "#ef4444"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#f1f5f9" }} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {peorSeccion && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/15 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <div>
                      <p className="text-rose-400 text-xs font-semibold">Mayor riesgo</p>
                      <p className="text-slate-300 text-xs">{peorSeccion.nombre} — {peorSeccion.grado} &ldquo;{peorSeccion.seccion}&rdquo; ({peorSeccion.porcentaje}%)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabla detalle */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold">Detalle por Materia y Sección</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Materia", "Grado", "Sección", "Presentes", "Ausentes", "% Asistencia"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 px-6 py-3 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrado.map((d, i) => (
                    <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-6 py-3 text-white text-sm font-medium">{d.nombre}</td>
                      <td className="px-6 py-3 text-slate-400 text-sm">{d.grado}</td>
                      <td className="px-6 py-3 text-slate-400 text-sm">&ldquo;{d.seccion}&rdquo;</td>
                      <td className="px-6 py-3 text-emerald-400 text-sm font-mono">{d.presentes}</td>
                      <td className="px-6 py-3 text-rose-400 text-sm font-mono">{d.ausentes}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full max-w-[80px]">
                            <div
                              className={`h-1.5 rounded-full ${d.porcentaje >= 90 ? "bg-emerald-500" : d.porcentaje >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${d.porcentaje}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${d.porcentaje >= 90 ? "text-emerald-400" : d.porcentaje >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                            {d.porcentaje}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
