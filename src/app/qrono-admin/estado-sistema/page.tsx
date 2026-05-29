"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Database, Lock, ScanLine, Activity, Clock, Zap
} from "lucide-react";

type Status = "ok" | "warning" | "error" | "loading";

interface DiagnosticoResult {
  nombre: string;
  estado: "ok" | "warning" | "error";
  mensaje: string;
  detalle?: string;
  latencia_ms?: number;
}

interface DiagnosticoData {
  ok: boolean;
  timestamp: string;
  estado_general: "ok" | "warning" | "error";
  resultados: DiagnosticoResult[];
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  "Base de Datos": Database,
  "Autenticación": Lock,
  "Consistencia de Registros": ScanLine,
};

function StatusBadge({ estado }: { estado: Status }) {
  if (estado === "loading") return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-white/10 rounded-full text-xs text-slate-400">
      <RefreshCw className="w-3 h-3 animate-spin" />
      Verificando...
    </div>
  );
  if (estado === "ok") return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs text-emerald-300">
      <CheckCircle2 className="w-3 h-3" />
      Operando Normal
    </div>
  );
  if (estado === "warning") return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs text-amber-300">
      <AlertTriangle className="w-3 h-3" />
      Advertencia
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-300">
      <XCircle className="w-3 h-3" />
      Error Crítico
    </div>
  );
}

function SemaforoLight({ estado }: { estado: Status }) {
  const configs = {
    loading: { color: "bg-slate-500", glow: "", pulse: true },
    ok: { color: "bg-emerald-500", glow: "shadow-emerald-500/50", pulse: false },
    warning: { color: "bg-amber-400", glow: "shadow-amber-400/50", pulse: true },
    error: { color: "bg-red-500", glow: "shadow-red-500/50", pulse: true },
  }[estado];

  return (
    <div className="flex gap-2 items-center">
      <div className={`w-3 h-3 rounded-full ${estado === "ok" || estado === "loading" ? "bg-emerald-500/20" : "bg-slate-800"}`} />
      <div className={`w-3 h-3 rounded-full ${estado === "warning" ? "bg-amber-400 animate-pulse" : "bg-slate-800"}`} />
      <div className={`w-3 h-3 rounded-full ${estado === "error" ? "bg-red-500 animate-pulse" : "bg-slate-800"}`} />
      <div className={`w-4 h-4 rounded-full shadow-lg ${configs.color} ${configs.glow} ${configs.pulse ? "animate-pulse" : ""}`} />
    </div>
  );
}

export default function EstadoSistemaPage() {
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  const runDiagnostico = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qrono-admin/diagnostico");
      const json = await res.json();
      setData(json as DiagnosticoData);
      setLastRun(new Date());
    } catch (e) {
      console.error("Error running diagnostico:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    if (!autoRan) {
      setAutoRan(true);
      runDiagnostico();
    }
  }, [autoRan, runDiagnostico]);

  const estadoGeneral: Status = loading ? "loading" : (data?.estado_general ?? "loading");

  const generalColors = {
    loading: { bg: "bg-slate-900/60", border: "border-white/10", title: "text-slate-400" },
    ok: { bg: "bg-emerald-950/50", border: "border-emerald-500/30", title: "text-emerald-300" },
    warning: { bg: "bg-amber-950/50", border: "border-amber-500/30", title: "text-amber-300" },
    error: { bg: "bg-red-950/50", border: "border-red-500/30", title: "text-red-300" },
  }[estadoGeneral];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-7 h-7 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Estado del Sistema</h1>
          </div>
          <p className="text-slate-400 text-sm">Diagnóstico técnico en tiempo real · Exclusivo SuperAdmin</p>
        </div>
        <button
          onClick={runDiagnostico}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-violet-500/25"
        >
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verificando...</>
            : <><Zap className="w-4 h-4" /> Ejecutar Diagnóstico Completo</>
          }
        </button>
      </div>

      {/* General Status Banner */}
      <div className={`rounded-2xl border p-5 backdrop-blur-xl ${generalColors.bg} ${generalColors.border} transition-all duration-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SemaforoLight estado={estadoGeneral} />
            <div>
              <p className={`text-lg font-bold ${generalColors.title}`}>
                {estadoGeneral === "loading" && "Ejecutando diagnóstico..."}
                {estadoGeneral === "ok" && "✅ Todos los sistemas operando con normalidad"}
                {estadoGeneral === "warning" && "⚠️ Sistema operando con advertencias"}
                {estadoGeneral === "error" && "🔴 Se detectaron errores críticos — Requiere atención"}
              </p>
              {lastRun && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Último diagnóstico: {lastRun.toLocaleTimeString("es-ES")}
                </p>
              )}
            </div>
          </div>
          <StatusBadge estado={estadoGeneral} />
        </div>
      </div>

      {/* Module Cards Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading && !data ? (
          ["Base de Datos", "Autenticación", "Consistencia de Registros"].map((name) => {
            const Icon = MODULE_ICONS[name] ?? Activity;
            return (
              <div key={name} className="glass-panel rounded-2xl p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 rounded-xl">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="h-4 bg-slate-800 rounded w-32" />
                </div>
                <div className="h-3 bg-slate-800 rounded w-full" />
                <div className="h-3 bg-slate-800 rounded w-2/3" />
              </div>
            );
          })
        ) : (
          data?.resultados.map((resultado) => {
            const Icon = MODULE_ICONS[resultado.nombre] ?? Activity;
            const cardColors = {
              ok: {
                bg: "bg-emerald-950/40",
                border: "border-emerald-500/25",
                iconBg: "bg-emerald-500/20 border-emerald-500/30",
                icon: "text-emerald-400",
                msg: "text-emerald-300",
              },
              warning: {
                bg: "bg-amber-950/40",
                border: "border-amber-500/25",
                iconBg: "bg-amber-500/20 border-amber-500/30",
                icon: "text-amber-400",
                msg: "text-amber-300",
              },
              error: {
                bg: "bg-red-950/40",
                border: "border-red-500/25",
                iconBg: "bg-red-500/20 border-red-500/30",
                icon: "text-red-400",
                msg: "text-red-300",
              },
            }[resultado.estado];

            return (
              <div
                key={resultado.nombre}
                className={`rounded-2xl border backdrop-blur-xl p-5 space-y-3 transition-all duration-500 ${cardColors.bg} ${cardColors.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${cardColors.iconBg}`}>
                      <Icon className={`w-5 h-5 ${cardColors.icon}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{resultado.nombre}</h3>
                  </div>
                  <StatusBadge estado={resultado.estado} />
                </div>

                <p className={`text-sm font-medium ${cardColors.msg}`}>{resultado.mensaje}</p>

                {resultado.detalle && (
                  <p className="text-xs text-slate-500 bg-black/20 rounded-lg px-3 py-2">
                    {resultado.detalle}
                  </p>
                )}

                {resultado.latencia_ms !== undefined && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Activity className="w-3 h-3" />
                    Latencia: {resultado.latencia_ms}ms
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info footer */}
      <div className="glass-panel rounded-xl p-4 flex items-start gap-3 text-sm">
        <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold text-xs">Panel Exclusivo SuperAdmin</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Este diagnóstico se ejecuta del lado del servidor usando el Service Role Key de Supabase.
            No es visible para roles inferiores. Haz clic en &ldquo;Ejecutar Diagnóstico Completo&rdquo; para refrescar todos los módulos.
          </p>
        </div>
      </div>
    </div>
  );
}
