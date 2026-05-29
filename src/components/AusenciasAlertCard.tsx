"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, UserX } from "lucide-react";

interface AusenteInfo {
  id: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  rol: string;
}

interface AusenciasData {
  ok: boolean;
  total_con_horario: number;
  total_escaneados: number;
  ausentes_count: number;
  ausentes: AusenteInfo[];
  fecha: string;
  fallback?: boolean;
}

export default function AusenciasAlertCard() {
  const [data, setData] = useState<AusenciasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAusencias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rrhh/ausencias-hoy");
      const json = await res.json();
      if (json.ok) setData(json as AusenciasData);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Error fetching ausencias:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAusencias();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAusencias, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAusencias]);

  const ausentes = data?.ausentes_count ?? 0;
  const urgency = ausentes === 0 ? "ok" : ausentes <= 2 ? "warn" : "critical";

  const colors = {
    ok: {
      bg: "bg-emerald-950/60",
      border: "border-emerald-500/30",
      glow: "shadow-emerald-500/10",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      count: "text-emerald-400",
      icon: "text-emerald-400",
    },
    warn: {
      bg: "bg-amber-950/60",
      border: "border-amber-500/30",
      glow: "shadow-amber-500/10",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      count: "text-amber-400",
      icon: "text-amber-400",
    },
    critical: {
      bg: "bg-red-950/60",
      border: "border-red-500/30",
      glow: "shadow-red-500/10",
      badge: "bg-red-500/20 text-red-300 border-red-500/30",
      count: "text-red-400",
      icon: "text-red-400",
    },
  }[urgency];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl ${colors.bg} ${colors.border} ${colors.glow} transition-all duration-500`}
    >
      {/* Animated background glow for critical */}
      {urgency === "critical" && (
        <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${colors.badge}`}>
              <AlertTriangle className={`w-5 h-5 ${colors.icon}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Ausencias Esta Mañana</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAusencias}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Big counter */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-7 h-7 text-slate-500 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-3">
              <span className={`text-5xl sm:text-6xl font-black leading-none ${colors.count}`}>
                {ausentes}
              </span>
              <div className="pb-1">
                <p className="text-sm font-semibold text-white leading-tight">
                  {ausentes === 1 ? "Profesor Ausente" : "Profesores Ausentes"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {data?.total_escaneados ?? 0} de {data?.total_con_horario ?? 0} han marcado
                </p>
              </div>
            </div>

            {/* Status pill */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colors.badge} mb-3`}>
              <span className={`w-1.5 h-1.5 rounded-full ${urgency === "ok" ? "bg-emerald-400" : urgency === "warn" ? "bg-amber-400 animate-pulse" : "bg-red-400 animate-pulse"}`} />
              {urgency === "ok" ? "✅ Todo el personal ha marcado" : urgency === "warn" ? "⚠️ Atención requerida" : "🔴 Acción inmediata requerida"}
            </div>

            {/* Expand toggle */}
            {ausentes > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mt-1"
              >
                <UserX className="w-3.5 h-3.5" />
                Ver quiénes no han marcado
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Expandable list */}
            {expanded && ausentes > 0 && (
              <div className="mt-3 space-y-2 animate-fade-in">
                {data?.ausentes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-black/20 rounded-xl border border-white/5"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-rose-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {p.nombres[0]}{p.apellidos[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {p.apellidos}, {p.nombres}
                      </p>
                      <p className="text-[10px] text-slate-500 capitalize">{p.cargo || p.rol}</p>
                    </div>
                    <span className="ml-auto flex-shrink-0 text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                      Sin marcar
                    </span>
                  </div>
                ))}
                {data?.fallback && (
                  <p className="text-[10px] text-slate-600 text-center pt-1">* Mostrando todo el personal activo (sin horario configurado)</p>
                )}
              </div>
            )}

            <p className="text-[9px] text-slate-700 mt-3">
              Actualizado: {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
