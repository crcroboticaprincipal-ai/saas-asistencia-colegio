"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Download, Mail, RefreshCw, Loader2, UserMinus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface AlertaDesercion {
  id: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  porcentaje_inasistencia: number;
  porcentaje_asistencia: number;
  motivo: string;
  nombre_representante: string;
  correo_representante: string;
}

export default function AlertasDesercionCard() {
  const [alertas, setAlertas] = useState<AlertaDesercion[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    try {
      // Read institucion_id from the non-httpOnly cookie set during login
      const instId = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin_institucion_id='))
        ?.split('=')[1] ?? '';

      const params = instId ? `?institucion_id=${encodeURIComponent(instId)}` : '';
      const res = await fetch(`/api/admin/alertas-desercion${params}`);
      const json = await res.json();
      if (json.ok) {
        setAlertas(json.alertas as AlertaDesercion[]);
      }
    } catch (e) {
      console.error("Error cargando alertas de deserción:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  const handleDescargarHistorial = async (estudianteId: string, nombreCompleto: string) => {
    setExportingId(estudianteId);
    try {
      const { data: asistencias, error } = await supabase
        .from("asistencias")
        .select(`
          id, estudiante_id, tipo, fecha, hora,
          estudiantes (cedula, nombre_completo, grado, seccion)
        `)
        .eq("estudiante_id", estudianteId)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (error) throw error;

      const response = await fetch("/api/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          data: asistencias || [], 
          horaOficialEntrada: "07:00" 
        })
      });

      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asisto_Historial_${nombreCompleto.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error(error);
      alert("Error al descargar el historial del estudiante.");
    } finally {
      setExportingId(null);
    }
  };

  const hasAlerts = alertas.length > 0;
  
  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-500 ${
      hasAlerts ? "bg-slate-950/60 border-rose-500/20 shadow-rose-500/5" : "bg-slate-950/60 border-white/5"
    }`}>
      {hasAlerts && (
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
      )}

      <div className="relative z-10">
        <button
          onClick={() => setPanelOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 p-5 sm:p-6 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              hasAlerts 
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                : "bg-white/5 text-slate-400 border-white/5"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alertas de Rendimiento y Asistencia</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {loading
                  ? "Analizando patrones de asistencia..."
                  : hasAlerts
                    ? `${alertas.length} estudiante${alertas.length > 1 ? "s" : ""} en riesgo detectado${alertas.length > 1 ? "s" : ""}`
                    : "Sin alertas activas — Todo en orden"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
            {hasAlerts && !loading && !panelOpen && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-full text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {alertas.length} en riesgo
              </span>
            )}
            {panelOpen
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </button>

        {panelOpen && (
          <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-white/5">
            <div className="flex justify-end pt-3 pb-2">
              <button
                onClick={(e) => { e.stopPropagation(); fetchAlertas(); }}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
                title="Actualizar Alertas"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            ) : alertas.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/5 rounded-xl bg-black/10">
                <span className="text-2xl">🛡️</span>
                <p className="text-sm font-semibold text-white mt-2">Todo en Orden</p>
                <p className="text-xs text-slate-400 mt-1">Ningún alumno presenta patrones de ausentismo crítico o faltas consecutivas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <p className="text-xs font-semibold text-rose-400">
                    Se detectaron {alertas.length} estudiantes en estado de &quot;Riesgo&quot;
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alertas.map((est) => {
                    const isExpanded = expandedStudent === est.id;
                    return (
                      <div 
                        key={est.id} 
                        className="p-4 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-white text-sm">{est.nombre_completo}</h4>
                              <p className="text-xs text-slate-400">{est.grado} &ldquo;{est.seccion}&rdquo;</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-rose-400 font-mono">
                                {est.porcentaje_inasistencia}% inasistencia
                              </span>
                              <p className="text-[10px] text-slate-500">
                                Asistencia: {est.porcentaje_asistencia}%
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 py-1.5 px-2.5 bg-rose-500/10 rounded-lg border border-rose-500/10">
                            <p className="text-xs text-rose-300 flex items-center gap-1.5 font-medium">
                              <UserMinus className="w-3.5 h-3.5 flex-shrink-0" />
                              {est.motivo}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setExpandedStudent(isExpanded ? null : est.id)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                              {isExpanded ? "Ocultar Representante" : "📞 Ver Representante"}
                            </button>
                            
                            <button
                              onClick={() => handleDescargarHistorial(est.id, est.nombre_completo)}
                              disabled={exportingId === est.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold transition-all"
                            >
                              {exportingId === est.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              Historial
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-xs text-slate-300">
                              <p className="font-semibold text-white border-b border-white/5 pb-1">
                                Contacto del Representante:
                              </p>
                              <p>
                                <span className="text-slate-500">Nombre:</span> {est.nombre_representante}
                              </p>
                              <p className="flex items-center gap-1.5 truncate">
                                <span className="text-slate-500">Correo:</span>
                                <a 
                                  href={`mailto:${est.correo_representante}`} 
                                  className="text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3" />
                                  {est.correo_representante}
                                </a>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
