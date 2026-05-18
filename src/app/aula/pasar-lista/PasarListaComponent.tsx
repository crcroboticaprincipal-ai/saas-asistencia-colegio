"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  BookOpen, QrCode, CheckCircle, XCircle, Clock,
  Loader2, ScanLine, RotateCcw, Users, Calendar
} from "lucide-react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ProfesorAsignacion, Estudiante } from "@/lib/supabase/types";

// PIN Login Modal
function PinLoginModal({ onLogin }: { onLogin: (personalId: string, nombres: string) => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin, institucion_nombre_corto: "CRC" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLogin(data.user.id, `${data.user.nombres} ${data.user.apellidos}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de acceso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8 border border-white/[0.08] shadow-2xl animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/15 rounded-2xl flex items-center justify-center border border-indigo-500/25 mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Terminal del Docente</h1>
          <p className="text-slate-400 text-sm mt-1">Acceso con usuario y PIN</p>
        </div>
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
            <XCircle className="w-4 h-4" /> {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Usuario</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_usuario"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">PIN</label>
            <input
              required
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              placeholder="••••••"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
            {loading ? "Verificando..." : "Ingresar al Aula"}
          </button>
        </form>
      </div>
    </div>
  );
}

// QR Scanner dinámico
const Html5QrScanner = dynamic(
  () => import("html5-qrcode").then((m) => {
    const { Html5Qrcode } = m;
    // Wrapper component
    const ScannerWrapper = ({ onScan }: { onScan: (code: string) => void }) => {
      useEffect(() => {
        const scanner = new Html5Qrcode("aula-qr-reader");
        scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 220, height: 220 } },
          (decoded) => { onScan(decoded); },
          () => {}
        );
        return () => { scanner.stop().catch(() => {}); };
      }, [onScan]);
      return <div id="aula-qr-reader" className="w-full rounded-xl overflow-hidden" />;
    };
    ScannerWrapper.displayName = "ScannerWrapper";
    return ScannerWrapper;
  }),
  { ssr: false }
);

export default function PasarListaComponent() {
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [personalNombre, setPersonalNombre] = useState("");
  const [asignaciones, setAsignaciones] = useState<ProfesorAsignacion[]>([]);
  const [asignacionSeleccionada, setAsignacionSeleccionada] = useState<ProfesorAsignacion | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [registrados, setRegistrados] = useState<{ estudiante: Estudiante; hora: string }[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error" | null; texto: string }>({ tipo: null, texto: "" });
  const [loading, setLoading] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const [diaFiltro, setDiaFiltro] = useState<number>(
    new Date().getDay() === 0 ? 7 : new Date().getDay()
  );

  useEffect(() => {
    if (!personalId) return;
    // Fetch all active assignments — include those with no specific day (null)
    supabase
      .from("profesores_asignaciones")
      .select("*, materia:materias(nombre, codigo)")
      .eq("personal_id", personalId)
      .eq("activo", true)
      .order("hora_inicio")
      .then(({ data }) => {
        if (data) setAsignaciones(data as ProfesorAsignacion[]);
      });
  }, [personalId]);

  const handleScan = async (qrCode: string) => {
    if (qrCode === lastCode) return;
    setLastCode(qrCode);
    setLoading(true);

    try {
      // Buscar estudiante
      const { data: estudiante, error } = await supabase
        .from("estudiantes")
        .select("*")
        .eq("qr_code", qrCode)
        .single();

      if (error || !estudiante) throw new Error("QR no reconocido");
      if (!asignacionSeleccionada) throw new Error("Selecciona una clase primero");

      // Verificar que el alumno pertenezca a la sección asignada
      if (estudiante.grado !== asignacionSeleccionada.grado ||
          estudiante.seccion !== asignacionSeleccionada.seccion) {
        throw new Error(`${estudiante.nombre_completo} no pertenece a ${asignacionSeleccionada.grado} "${asignacionSeleccionada.seccion}"`);
      }

      // Verificar si ya está registrado hoy en esta clase
      const yaRegistrado = registrados.some((r) => r.estudiante.id === estudiante.id);
      if (yaRegistrado) throw new Error(`${estudiante.nombre_completo} ya fue registrado`);

      // Insertar asistencia de materia
      const horaAhora = format(new Date(), "HH:mm:ss");
      const fechaHoy = format(new Date(), "yyyy-MM-dd");

      await supabase.from("asistencia_materia").upsert([{
        institucion_id: estudiante.institucion_id,
        asignacion_id: asignacionSeleccionada.id,
        estudiante_id: estudiante.id,
        fecha: fechaHoy,
        hora_escaneo: horaAhora,
        estado: "Presente",
      }], { onConflict: "asignacion_id,estudiante_id,fecha" });

      setRegistrados((prev) => [...prev, { estudiante, hora: horaAhora }]);
      setMensaje({ tipo: "ok", texto: `✓ ${estudiante.nombre_completo}` });

    } catch (err: unknown) {
      setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "Error" });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setMensaje({ tipo: null, texto: "" });
        setLastCode(null);
      }, 800);
    }
  };

  const DIAS_LABEL: Record<number, string> = {
    1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
    5: "Viernes", 6: "Sábado", 7: "Domingo",
  };
  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  // Filter assignments by selected day (null dia_semana means applies to any day)
  const asignacionesFiltradas = asignaciones.filter(
    (a) => a.dia_semana === null || a.dia_semana === undefined || (a as any).dia_semana === diaFiltro
  );

  if (!personalId) {
    return <PinLoginModal onLogin={(id, nombre) => { setPersonalId(id); setPersonalNombre(nombre); }} />;
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" /> Terminal del Aula
          </h1>
          <p className="text-slate-400 text-xs">{personalNombre} · {hoy}</p>
        </div>
        <button
          onClick={() => { setPersonalId(null); setAsignaciones([]); setAsignacionSeleccionada(null); setEscaneando(false); setRegistrados([]); }}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Salir
        </button>
      </div>

      {/* Selector de clase */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Mis Clases</p>
          {/* Day filter */}
          <select
            value={diaFiltro}
            onChange={(e) => { setDiaFiltro(Number(e.target.value)); setAsignacionSeleccionada(null); setEscaneando(false); setRegistrados([]); }}
            className="bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>{DIAS_LABEL[d]}</option>
            ))}
          </select>
        </div>
        {asignacionesFiltradas.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No tienes clases configuradas para {DIAS_LABEL[diaFiltro]}</p>
        ) : (
          <div className="space-y-2">
            {asignacionesFiltradas.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAsignacionSeleccionada(a); setEscaneando(false); setRegistrados([]); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border text-left ${
                  asignacionSeleccionada?.id === a.id
                    ? "bg-indigo-500/15 border-indigo-500/25 text-indigo-300"
                    : "bg-slate-800/30 border-white/5 text-slate-300 hover:bg-white/5"
                }`}
              >
                <div>
                  <p className="font-semibold text-sm">{(a.materia as { nombre: string } | undefined)?.nombre || "Materia"}</p>
                  <p className="text-xs text-slate-500">{a.grado} &ldquo;{a.seccion}&rdquo; · {a.hora_inicio.slice(0, 5)} - {a.hora_fin.slice(0, 5)}</p>
                </div>
                {asignacionSeleccionada?.id === a.id && <CheckCircle className="w-5 h-5 text-indigo-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scanner de aula */}
      {asignacionSeleccionada && (
        <div className="glass-panel rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              {(asignacionSeleccionada.materia as { nombre: string } | undefined)?.nombre} — {asignacionSeleccionada.grado} &ldquo;{asignacionSeleccionada.seccion}&rdquo;
            </p>
            <button
              onClick={() => setEscaneando(!escaneando)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                escaneando
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {escaneando ? <><XCircle className="w-4 h-4" /> Detener</> : <><ScanLine className="w-4 h-4" /> Iniciar Escáner</>}
            </button>
          </div>

          {/* Mensaje de resultado */}
          {mensaje.tipo && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              mensaje.tipo === "ok"
                ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                : "bg-rose-500/15 border border-rose-500/25 text-rose-400"
            }`}>
              {mensaje.tipo === "ok" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {mensaje.texto}
            </div>
          )}

          {/* Cámara */}
          {escaneando && <Html5QrScanner onScan={handleScan} />}

          {/* Lista de registrados */}
          <div>
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> {registrados.length} alumno{registrados.length !== 1 ? "s" : ""} registrado{registrados.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {registrados.map((r, i) => (
                <div key={r.estudiante.id} className="flex items-center justify-between px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                    <p className="text-sm text-white font-medium">{r.estudiante.nombre_completo}</p>
                  </div>
                  <p className="text-xs text-emerald-400 font-mono">{r.hora.slice(0, 5)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
