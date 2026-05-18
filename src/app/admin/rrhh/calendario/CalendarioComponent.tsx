"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle,
  AlertCircle, Loader2, UserCog
} from "lucide-react";
import type { Personal, AsistenciaPersonal } from "@/lib/supabase/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isSameMonth, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const ESTADO_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  "Puntual": { color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30", label: "✓" },
  "Retardo": { color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/30", label: "R" },
  "Salida Temprana": { color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30", label: "ST" },
  "Sin Evaluar": { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "?" },
};

export default function CalendarioRRHH() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Personal | null>(null);
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([]);
  const [mesActual, setMesActual] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("personal")
      .select("id, nombres, apellidos, rol, cargo, activo")
      .eq("activo", true)
      .order("apellidos")
      .then(({ data }) => { if (data) setPersonal(data as Personal[]); });
  }, []);

  useEffect(() => {
    if (!selectedEmpleado) return;
    fetchAsistencias();
  }, [selectedEmpleado, mesActual]);

  const fetchAsistencias = async () => {
    if (!selectedEmpleado) return;
    setLoading(true);
    const inicio = format(startOfMonth(mesActual), "yyyy-MM-dd");
    const fin = format(endOfMonth(mesActual), "yyyy-MM-dd");

    const { data } = await supabase
      .from("asistencia_personal")
      .select("*")
      .eq("personal_id", selectedEmpleado.id)
      .gte("fecha", inicio)
      .lte("fecha", fin)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });

    setAsistencias(data as AsistenciaPersonal[] || []);
    setLoading(false);
  };

  const diasDelMes = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(mesActual),
      end: endOfMonth(mesActual),
    });
  }, [mesActual]);

  // Índice de asistencias por fecha
  const asistenciasPorDia = useMemo(() => {
    const idx: Record<string, { entrada?: AsistenciaPersonal; salida?: AsistenciaPersonal }> = {};
    asistencias.forEach((a) => {
      if (!idx[a.fecha]) idx[a.fecha] = {};
      if (a.tipo === "ENTRADA") idx[a.fecha].entrada = a;
      if (a.tipo === "SALIDA") idx[a.fecha].salida = a;
    });
    return idx;
  }, [asistencias]);

  const estadisticas = useMemo(() => {
    const entradas = asistencias.filter((a) => a.tipo === "ENTRADA");
    const puntuales = entradas.filter((a) => a.estado_evaluacion === "Puntual").length;
    const retardos = entradas.filter((a) => a.estado_evaluacion === "Retardo").length;
    const total = entradas.length;
    return { total, puntuales, retardos, porcPuntualidad: total > 0 ? Math.round((puntuales / total) * 100) : 0 };
  }, [asistencias]);

  const primerDiaSemana = getDay(startOfMonth(mesActual));
  const offsetDias = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1; // lunes = 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Calendar className="w-8 h-8 text-emerald-400" />
          Calendario de Asistencia — Personal
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Vista mensual por empleado · Verde = Puntual · Rojo = Retardo · Gris = Sin registro</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Selector de empleado */}
        <div className="glass-panel rounded-2xl p-4 space-y-2 lg:col-span-1 max-h-[600px] overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 mb-3">Seleccionar Empleado</p>
          {personal.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">No hay personal registrado</p>
          ) : (
            personal.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedEmpleado(p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  selectedEmpleado?.id === p.id
                    ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {p.nombres[0]}{p.apellidos[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.apellidos}, {p.nombres}</p>
                  <p className="text-[10px] text-slate-500 truncate">{p.cargo || p.rol}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Calendario */}
        <div className="lg:col-span-3 space-y-4">
          {selectedEmpleado ? (
            <>
              {/* Controles de mes */}
              <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-white capitalize">
                    {format(mesActual, "MMMM yyyy", { locale: es })}
                  </p>
                  <p className="text-sm text-slate-400">{selectedEmpleado.apellidos}, {selectedEmpleado.nombres}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMesActual(subMonths(mesActual, 1))} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setMesActual(new Date())} className="px-3 py-1.5 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    Hoy
                  </button>
                  <button onClick={() => setMesActual(addMonths(mesActual, 1))} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* KPIs del mes */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Días con Reg.", value: estadisticas.total, color: "text-white" },
                  { label: "Puntual", value: estadisticas.puntuales, color: "text-emerald-400" },
                  { label: "Retardos", value: estadisticas.retardos, color: "text-rose-400" },
                  { label: "Puntualidad", value: `${estadisticas.porcPuntualidad}%`, color: estadisticas.porcPuntualidad >= 90 ? "text-emerald-400" : estadisticas.porcPuntualidad >= 70 ? "text-amber-400" : "text-rose-400" },
                ].map((k) => (
                  <div key={k.label} className="glass-panel p-3 rounded-xl text-center">
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Grid del calendario */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-4">
                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 mb-2">
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                      <div key={d} className="text-center text-xs font-semibold text-slate-600 py-2">{d}</div>
                    ))}
                  </div>

                  {/* Celdas */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Offset de inicio */}
                    {Array.from({ length: offsetDias }).map((_, i) => (
                      <div key={`off-${i}`} />
                    ))}

                    {diasDelMes.map((dia) => {
                      const key = format(dia, "yyyy-MM-dd");
                      const registro = asistenciasPorDia[key];
                      const esFinde = [0, 6].includes(getDay(dia));
                      const hoy = isToday(dia);
                      const estado = registro?.entrada?.estado_evaluacion;

                      let cellClass = "bg-slate-800/30 border-white/5";
                      if (esFinde) cellClass = "bg-slate-900/30 border-white/[0.03]";
                      if (registro?.entrada) {
                        if (estado === "Puntual") cellClass = "bg-emerald-500/10 border-emerald-500/20";
                        else if (estado === "Retardo") cellClass = "bg-rose-500/10 border-rose-500/20";
                        else cellClass = "bg-amber-500/10 border-amber-500/20";
                      }
                      if (hoy) cellClass += " ring-2 ring-blue-500/50";

                      return (
                        <div key={key} className={`rounded-xl border p-1.5 min-h-[64px] ${cellClass} transition-all`}>
                          <p className={`text-xs font-semibold mb-1 ${hoy ? "text-blue-400" : esFinde ? "text-slate-600" : "text-slate-400"}`}>
                            {format(dia, "d")}
                          </p>
                          {registro?.entrada && (
                            <div className="space-y-0.5">
                              <p className="text-[9px] text-emerald-400 font-mono leading-tight">
                                ▲ {registro.entrada.hora.slice(0, 5)}
                              </p>
                              {registro.entrada.estado_evaluacion === "Retardo" && (
                                <p className="text-[9px] text-rose-400 font-mono leading-tight">
                                  +{registro.entrada.minutos_diferencia}m
                                </p>
                              )}
                            </div>
                          )}
                          {registro?.salida && (
                            <p className="text-[9px] text-slate-500 font-mono leading-tight mt-0.5">
                              ▼ {registro.salida.hora.slice(0, 5)}
                            </p>
                          )}
                          {!registro && !esFinde && (
                            <div className="w-full h-1 bg-slate-700/50 rounded-full mt-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Leyenda */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5 flex-wrap">
                    {[
                      { color: "bg-emerald-500/20 border-emerald-500/30", label: "Puntual" },
                      { color: "bg-rose-500/20 border-rose-500/30", label: "Retardo" },
                      { color: "bg-amber-500/20 border-amber-500/30", label: "Salida Temprana" },
                      { color: "bg-slate-800/30 border-white/5", label: "Sin registro" },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded border ${l.color}`} />
                        <span className="text-xs text-slate-500">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-panel rounded-2xl flex flex-col items-center justify-center py-20 text-center">
              <UserCog className="w-16 h-16 text-slate-700 mb-4" />
              <p className="text-slate-400 font-medium">Selecciona un empleado</p>
              <p className="text-slate-600 text-sm mt-1">Elige un empleado de la lista para ver su calendario de asistencia</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
