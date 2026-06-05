"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "@/lib/supabase/client";
import {
  BookOpen,
  XCircle,
  Loader2,
  RotateCcw,
  CheckCircle,
  Users,
  ScanLine,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ProfesorAsignacion } from "@/lib/supabase/types";
import Image from "next/image";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type EstudianteConPorteria = {
  id: string;
  nombre_completo: string;
  cedula: string;
  foto_url: string | null;
  grado: string;
  seccion: string;
  institucion_id: string;
  qr_code: string;
  hora_entrada_porteria: string | null;
  asistencia_aula_hoy: string | null;
};

type SwipeDecision = "presente" | "ausente";

type RegistradoItem = {
  estudiante: EstudianteConPorteria;
  decision: SwipeDecision;
  hora: string;
};

// ─────────────────────────────────────────────────────────
// QR Scanner (dynamic import — SSR off)
// ─────────────────────────────────────────────────────────
const AulaQrScanner = dynamic(
  () =>
    import("html5-qrcode").then((m) => {
      const { Html5Qrcode } = m;
      function ScannerWrapper({ onScan }: { onScan: (code: string) => void }) {
        const onScanRef = useRef(onScan);
        onScanRef.current = onScan;
        useEffect(() => {
          const scanner = new Html5Qrcode("aula-swipe-qr-reader");
          scanner
            .start(
              { facingMode: "environment" },
              { fps: 15, qrbox: { width: 220, height: 220 } },
              (decoded) => onScanRef.current(decoded),
              () => {}
            )
            .catch(() => {});
          return () => {
            scanner.stop().catch(() => {});
          };
        }, []);
        return (
          <div
            id="aula-swipe-qr-reader"
            className="w-full rounded-2xl overflow-hidden"
          />
        );
      }
      ScannerWrapper.displayName = "ScannerWrapper";
      return ScannerWrapper;
    }),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────
// PIN Login Modal
// ─────────────────────────────────────────────────────────
function PinLoginModal({
  onLogin,
}: {
  onLogin: (id: string, nombre: string) => void;
}) {
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
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Usuario
            </label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu_usuario"
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              PIN
            </label>
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
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <BookOpen className="w-5 h-5" />
            )}
            {loading ? "Verificando..." : "Ingresar al Aula"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Swipe Card Component
// ─────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 80;

function SwipeCard({
  estudiante,
  isTop,
  onDecision,
}: {
  estudiante: EstudianteConPorteria;
  isTop: boolean;
  onDecision: (id: string, decision: SwipeDecision) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const applyTransform = (dx: number) => {
    const el = cardRef.current;
    if (!el) return;
    const rotate = dx * 0.08;
    const opacity = Math.max(0, 1 - Math.abs(dx) / 300);
    el.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
    el.style.opacity = String(opacity);
    // Color overlay hint
    if (dx > 20) {
      el.style.boxShadow = `0 0 40px rgba(16,185,129,${Math.min(0.6, dx / 200)})`;
    } else if (dx < -20) {
      el.style.boxShadow = `0 0 40px rgba(239,68,68,${Math.min(0.6, -dx / 200)})`;
    } else {
      el.style.boxShadow = "";
    }
  };

  const resetTransform = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s, box-shadow 0.35s";
    el.style.transform = "translateX(0) rotate(0deg)";
    el.style.opacity = "1";
    el.style.boxShadow = "";
    setTimeout(() => {
      if (el) el.style.transition = "";
    }, 380);
  };

  const fireDecision = (decision: SwipeDecision) => {
    const el = cardRef.current;
    if (!el) return;
    const dir = decision === "presente" ? 1 : -1;
    el.style.transition = "transform 0.3s ease-in, opacity 0.3s ease-in";
    el.style.transform = `translateX(${dir * 600}px) rotate(${dir * 20}deg)`;
    el.style.opacity = "0";
    setTimeout(() => {
      onDecision(estudiante.id, decision);
    }, 310);
  };

  // Pointer events (works on touch + mouse universally)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = cardRef.current;
    if (el) el.style.transition = "";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !isTop) return;
    const dx = e.clientX - startXRef.current;
    currentXRef.current = dx;
    applyTransform(dx);
  };

  const onPointerUp = () => {
    if (!isDraggingRef.current || !isTop) return;
    isDraggingRef.current = false;
    const dx = currentXRef.current;
    if (dx > SWIPE_THRESHOLD) {
      fireDecision("presente");
    } else if (dx < -SWIPE_THRESHOLD) {
      fireDecision("ausente");
    } else {
      resetTransform();
    }
  };

  const porteriaText = estudiante.hora_entrada_porteria
    ? `🟢 Ingresó al plantel ${estudiante.hora_entrada_porteria.slice(0, 5)}`
    : "⬜ Sin registro en portería";

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 rounded-3xl cursor-grab active:cursor-grabbing select-none"
      style={{
        touchAction: "none",
        willChange: "transform",
        userSelect: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Card body */}
      <div className="h-full rounded-3xl overflow-hidden bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center gap-5 p-8">
        {/* Swipe hint overlays */}
        <div
          className="absolute inset-0 rounded-3xl bg-emerald-500/20 flex items-center justify-start pl-8 pointer-events-none transition-opacity duration-100"
          style={{ opacity: isTop ? undefined : 0 }}
          id={`hint-present-${estudiante.id}`}
        >
          <span className="text-4xl font-black text-emerald-400 tracking-wider rotate-[-15deg] border-4 border-emerald-400 rounded-xl px-4 py-1 opacity-0 group-present-hint">
            PRESENTE
          </span>
        </div>
        <div
          className="absolute inset-0 rounded-3xl bg-rose-500/20 flex items-center justify-end pr-8 pointer-events-none"
          id={`hint-absent-${estudiante.id}`}
        >
          <span className="text-4xl font-black text-rose-400 tracking-wider rotate-[15deg] border-4 border-rose-400 rounded-xl px-4 py-1 opacity-0">
            AUSENTE
          </span>
        </div>

        {/* Photo */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/10 shadow-2xl bg-slate-700 flex items-center justify-center">
            {estudiante.foto_url ? (
              <Image
                src={estudiante.foto_url}
                alt={estudiante.nombre_completo}
                width={112}
                height={112}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-4xl font-bold text-slate-400">
                {estudiante.nombre_completo.charAt(0)}
              </span>
            )}
          </div>
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/30 blur-sm" />
        </div>

        {/* Info */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white leading-tight px-2">
            {estudiante.nombre_completo}
          </h2>
          <p className="text-slate-400 text-sm font-mono tracking-wider">
            C.I: {estudiante.cedula}
          </p>
          <span className="inline-block px-3 py-1 bg-indigo-500/15 border border-indigo-500/25 rounded-full text-indigo-300 text-xs font-semibold">
            {estudiante.grado} &ldquo;{estudiante.seccion}&rdquo;
          </span>
          {/* Portería status */}
          <p className="text-slate-400 text-xs mt-2 px-4 py-2 bg-slate-800/60 rounded-xl">
            {porteriaText}
          </p>
        </div>

        {/* Swipe hint arrows */}
        {isTop && (
          <div className="flex items-center justify-between w-full px-4 mt-2">
            <div className="flex items-center gap-1 text-rose-400/70 text-xs font-semibold">
              <ChevronLeft className="w-4 h-4" />
              <span>Ausente</span>
            </div>
            <div className="text-slate-600 text-[10px] text-center">
              desliza para marcar
            </div>
            <div className="flex items-center gap-1 text-emerald-400/70 text-xs font-semibold">
              <span>Presente</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────
const SESSION_KEY = "asisto_docente_session";
const SESSION_TTL = 60 * 60 * 24 * 30 * 1000; // 30 days

const DIAS_LABEL: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábado", 7: "Domingo",
};

export default function PasarListaComponent() {
  // ── Auth state ──
  const [personalId, setPersonalId] = useState<string | null>(null);
  const [personalNombre, setPersonalNombre] = useState("");
  const [sessionRestored, setSessionRestored] = useState(false);

  // ── Assignments ──
  const [asignaciones, setAsignaciones] = useState<ProfesorAsignacion[]>([]);
  const [asignacionSeleccionada, setAsignacionSeleccionada] = useState<ProfesorAsignacion | null>(null);
  const [claseActiva, setClaseActiva] = useState<ProfesorAsignacion | null>(null); // auto-detected
  const [diaFiltro, setDiaFiltro] = useState<number>(
    new Date().getDay() === 0 ? 7 : new Date().getDay()
  );
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);

  // ── Students / swipe pile ──
  const [todosEstudiantes, setTodosEstudiantes] = useState<EstudianteConPorteria[]>([]);
  const [pila, setPila] = useState<EstudianteConPorteria[]>([]); // remaining to swipe
  const [registrados, setRegistrados] = useState<RegistradoItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // ── QR Scanner ──
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<{ tipo: "ok" | "error" | null; texto: string }>({ tipo: null, texto: "" });
  const [scanProcessing, setScanProcessing] = useState(false);

  // ── Misc ──
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "error" } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, tipo: "ok" | "error" = "ok") => {
    setToast({ msg, tipo });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ─────────────────────────────────────────────────────
  // Session persistence
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id, nombre, expiry } = JSON.parse(raw);
        if (expiry && Date.now() < expiry && id && nombre) {
          setPersonalId(id);
          setPersonalNombre(nombre);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch { /* ignore */ } finally {
      setSessionRestored(true);
    }
  }, []);

  const handleLogin = (id: string, nombre: string) => {
    setPersonalId(id);
    setPersonalNombre(nombre);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id, nombre, expiry: Date.now() + SESSION_TTL }));
    } catch { /* ignore */ }
  };

  const handleLogout = () => {
    setPersonalId(null);
    setAsignaciones([]);
    setAsignacionSeleccionada(null);
    setClaseActiva(null);
    setPila([]);
    setRegistrados([]);
    setTodosEstudiantes([]);
    setShowScanner(false);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  };

  // ─────────────────────────────────────────────────────
  // Load assignments + auto-detect active class
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!personalId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("profesores_asignaciones")
          .select("*, materia:materias(nombre, codigo)")
          .eq("personal_id", personalId)
          .eq("activo", true)
          .order("hora_inicio");
        if (cancelled || !data) return;
        const asigs = data as ProfesorAsignacion[];
        setAsignaciones(asigs);

        // Auto-detect current time block
        const now = new Date();
        const todayNum = now.getDay() === 0 ? 7 : now.getDay();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const active = asigs.find((a) => {
          const dayMatch = a.dia_semana === null || a.dia_semana === undefined || a.dia_semana === todayNum;
          if (!dayMatch) return false;
          const [sh, sm] = a.hora_inicio.split(":").map(Number);
          const [eh, em] = a.hora_fin.split(":").map(Number);
          return nowMinutes >= sh * 60 + sm && nowMinutes <= eh * 60 + em;
        });
        if (active) {
          setClaseActiva(active);
          setAsignacionSeleccionada(active);
        }
      } finally {
        if (!cancelled) setLoadingAsignaciones(false);
      }
    };
    setLoadingAsignaciones(true);
    load();
    return () => { cancelled = true; };
  }, [personalId]);

  // ─────────────────────────────────────────────────────
  // Load students when assignment selected
  // ─────────────────────────────────────────────────────
  const loadStudents = useCallback(async (asignacion: ProfesorAsignacion) => {
    setLoadingStudents(true);
    setTodosEstudiantes([]);
    setPila([]);
    setRegistrados([]);
    try {
      const params = new URLSearchParams({
        grado: asignacion.grado,
        seccion: asignacion.seccion,
        ...(asignacion.institucion_id ? { institucion_id: asignacion.institucion_id } : {}),
      });
      const res = await fetch(`/api/aula/estudiantes-seccion?${params}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const students: EstudianteConPorteria[] = data.data;
      setTodosEstudiantes(students);

      // Pre-filter: put already-marked students into registrados, rest into pila
      const sinMarcar = students.filter((s) => !s.asistencia_aula_hoy);
      const yaRegistrados: RegistradoItem[] = students
        .filter((s) => s.asistencia_aula_hoy)
        .map((s) => ({
          estudiante: s,
          decision: (s.asistencia_aula_hoy === "Presente" ? "presente" : "ausente") as SwipeDecision,
          hora: new Date().toTimeString().slice(0, 5),
        }));

      setPila(sinMarcar);
      setRegistrados(yaRegistrados);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al cargar estudiantes", "error");
    } finally {
      setLoadingStudents(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (asignacionSeleccionada) {
      loadStudents(asignacionSeleccionada);
    }
  }, [asignacionSeleccionada, loadStudents]);

  // ─────────────────────────────────────────────────────
  // Handle swipe decision
  // ─────────────────────────────────────────────────────
  const handleDecision = useCallback(async (estudianteId: string, decision: SwipeDecision) => {
    const estudiante = pila.find((e) => e.id === estudianteId);
    if (!estudiante || !asignacionSeleccionada) return;

    // Optimistic update
    setPila((prev) => prev.filter((e) => e.id !== estudianteId));
    const hora = new Date().toTimeString().slice(0, 8);
    setRegistrados((prev) => [...prev, { estudiante, decision, hora }]);

    // Background mutation
    try {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      await supabase.from("asistencia_materia").upsert(
        [{
          institucion_id: estudiante.institucion_id,
          asignacion_id: asignacionSeleccionada.id,
          estudiante_id: estudiante.id,
          fecha: fechaHoy,
          hora_escaneo: hora,
          estado: decision === "presente" ? "Presente" : "Ausente",
        }],
        { onConflict: "asignacion_id,estudiante_id,fecha" }
      );
    } catch {
      // Non-blocking: the UI is already updated
    }
  }, [pila, asignacionSeleccionada]);

  // ─────────────────────────────────────────────────────
  // QR Scan handler
  // ─────────────────────────────────────────────────────
  const handleQrScan = useCallback(async (qrCode: string) => {
    if (qrCode === lastScannedCode || scanProcessing) return;
    setLastScannedCode(qrCode);
    setScanProcessing(true);
    setScanMsg({ tipo: null, texto: "" });

    try {
      const estudiante = todosEstudiantes.find((e) => e.qr_code === qrCode);
      if (!estudiante) {
        setScanMsg({ tipo: "error", texto: "❌ Código no corresponde a ningún alumno de esta sección" });
        return;
      }

      const yaEnPila = pila.some((e) => e.id === estudiante.id);
      const yaRegistrado = registrados.some((r) => r.estudiante.id === estudiante.id);

      if (yaRegistrado) {
        setScanMsg({ tipo: "error", texto: `${estudiante.nombre_completo} ya fue marcado` });
        return;
      }

      if (!yaEnPila) {
        setScanMsg({ tipo: "error", texto: "Alumno no encontrado en la pila activa" });
        return;
      }

      // Play success sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* ignore audio errors */ }

      await handleDecision(estudiante.id, "presente");
      setScanMsg({ tipo: "ok", texto: `✓ ${estudiante.nombre_completo} — Presente` });

    } finally {
      setScanProcessing(false);
      setTimeout(() => {
        setScanMsg({ tipo: null, texto: "" });
        setLastScannedCode(null);
      }, 1800);
    }
  }, [lastScannedCode, scanProcessing, todosEstudiantes, pila, registrados, handleDecision]);

  // ─────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────
  const topCard = pila[pila.length - 1] ?? null;
  const secondCard = pila[pila.length - 2] ?? null;
  const total = todosEstudiantes.length;
  const restantes = pila.length;
  const completados = registrados.length;
  const progresoPct = total > 0 ? Math.round((completados / total) * 100) : 0;

  const asignacionesFiltradas = useMemo(
    () => asignaciones.filter(
      (a) => a.dia_semana === null || a.dia_semana === undefined || (a as { dia_semana?: number }).dia_semana === diaFiltro
    ),
    [asignaciones, diaFiltro]
  );

  const materiaLabel = useMemo(() => {
    if (!asignacionSeleccionada) return null;
    const m = asignacionSeleccionada.materia as { nombre: string } | undefined;
    return m?.nombre ?? "Clase";
  }, [asignacionSeleccionada]);

  // ─────────────────────────────────────────────────────
  // Early returns
  // ─────────────────────────────────────────────────────
  if (!sessionRestored) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!personalId) {
    return <PinLoginModal onLogin={handleLogin} />;
  }

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  // ─────────────────────────────────────────────────────
  // Render: Selector de clase (when no assignment selected)
  // ─────────────────────────────────────────────────────
  if (!asignacionSeleccionada) {
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
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Salir
          </button>
        </div>

        {/* Class selector */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Mis Clases
            </p>
            <select
              value={diaFiltro}
              onChange={(e) => setDiaFiltro(Number(e.target.value))}
              className="bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>{DIAS_LABEL[d]}</option>
              ))}
            </select>
          </div>

          {loadingAsignaciones ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : asignacionesFiltradas.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              No tienes clases configuradas para {DIAS_LABEL[diaFiltro]}
            </p>
          ) : (
            <div className="space-y-2">
              {asignacionesFiltradas.map((a) => {
                const m = a.materia as { nombre: string } | undefined;
                const isActive = claseActiva?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAsignacionSeleccionada(a)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border text-left ${
                      isActive
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                        : "bg-slate-800/30 border-white/5 text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {m?.nombre ?? "Materia"}
                        {isActive && (
                          <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                            ACTIVA AHORA
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.grado} &ldquo;{a.seccion}&rdquo; · {a.hora_inicio.slice(0, 5)} - {a.hora_fin.slice(0, 5)}
                      </p>
                    </div>
                    {isActive && <Zap className="w-5 h-5 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // Render: Swipe Card Interface
  // ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="glass-panel rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setAsignacionSeleccionada(null); setShowScanner(false); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{materiaLabel}</p>
              <p className="text-slate-400 text-xs">
                {asignacionSeleccionada.grado} &ldquo;{asignacionSeleccionada.seccion}&rdquo; · {personalNombre}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Active class banner */}
        {claseActiva?.id === asignacionSeleccionada.id && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs font-semibold">
              Clase Activa: {materiaLabel} — {asignacionSeleccionada.grado} &ldquo;{asignacionSeleccionada.seccion}&rdquo;
            </p>
          </div>
        )}

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Restantes: <span className="text-white font-bold ml-1">{restantes}</span>
                <span className="text-slate-600 mx-1">/</span>
                <span className="text-slate-400">{total}</span>
              </span>
              <span className="text-slate-500">{progresoPct}% completado</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Swipe Area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
        {loadingStudents ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Cargando lista...</p>
          </div>
        ) : pila.length === 0 ? (
          // ── All done ──
          <div className="text-center space-y-5 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">¡Lista Completa!</h2>
              <p className="text-slate-400 text-sm mt-1">
                {registrados.filter((r) => r.decision === "presente").length} presentes ·{" "}
                {registrados.filter((r) => r.decision === "ausente").length} ausentes
              </p>
            </div>
            {/* Summary list */}
            <div className="w-full max-w-sm text-left space-y-1.5 max-h-64 overflow-y-auto">
              {registrados.map((r) => (
                <div
                  key={r.estudiante.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm border ${
                    r.decision === "presente"
                      ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/5 border-rose-500/15 text-rose-300"
                  }`}
                >
                  <span className="truncate">{r.estudiante.nombre_completo}</span>
                  <span className="text-xs ml-2 font-mono flex-shrink-0">
                    {r.decision === "presente" ? "✓" : "✗"} {r.hora.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── Card pile ──
          <div
            className="relative w-full"
            style={{ height: "440px", maxWidth: "340px" }}
          >
            {/* Second card (behind) */}
            {secondCard && (
              <div
                key={secondCard.id}
                className="absolute inset-0 rounded-3xl"
                style={{
                  transform: "scale(0.93) translateY(12px)",
                  opacity: 0.5,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                <div className="h-full rounded-3xl bg-slate-800/70 border border-white/5" />
              </div>
            )}

            {/* Top card */}
            {topCard && (
              <div key={topCard.id} className="absolute inset-0" style={{ zIndex: 2 }}>
                <SwipeCard
                  estudiante={topCard}
                  isTop
                  onDecision={handleDecision}
                />
              </div>
            )}
          </div>
        )}

        {/* Quick action buttons below the card */}
        {pila.length > 0 && !loadingStudents && (
          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={() => topCard && handleDecision(topCard.id, "ausente")}
              className="w-14 h-14 rounded-full bg-rose-500/15 border-2 border-rose-500/30 text-rose-400 flex items-center justify-center hover:bg-rose-500/25 hover:scale-110 transition-all shadow-lg"
              title="Marcar Ausente"
            >
              <XCircle className="w-7 h-7" />
            </button>
            <div className="text-center">
              <p className="text-slate-500 text-[10px] font-medium">o usa los botones</p>
            </div>
            <button
              onClick={() => topCard && handleDecision(topCard.id, "presente")}
              className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 hover:scale-110 transition-all shadow-lg"
              title="Marcar Presente"
            >
              <CheckCircle className="w-7 h-7" />
            </button>
          </div>
        )}
      </div>

      {/* ── QR Scanner FAB ── */}
      {!showScanner && asignacionSeleccionada && (
        <button
          onClick={() => setShowScanner(true)}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/40 hover:scale-110 transition-all border-2 border-indigo-400/30"
          title="Escanear en Aula"
        >
          <ScanLine className="w-7 h-7" />
        </button>
      )}

      {/* ── QR Scanner Overlay ── */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <h2 className="text-white font-bold flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-indigo-400" />
                Escáner de Aula
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {materiaLabel} · {asignacionSeleccionada?.grado} &ldquo;{asignacionSeleccionada?.seccion}&rdquo;
              </p>
            </div>
            <button
              onClick={() => { setShowScanner(false); setScanMsg({ tipo: null, texto: "" }); }}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
            {/* Result message */}
            {scanMsg.tipo && (
              <div
                className={`w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                  scanMsg.tipo === "ok"
                    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
                    : "bg-rose-500/15 border-rose-500/25 text-rose-300"
                }`}
              >
                {scanMsg.tipo === "ok"
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 flex-shrink-0" />}
                {scanMsg.texto}
              </div>
            )}

            {/* Camera */}
            <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <AulaQrScanner onScan={handleQrScan} />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-400">
                  {registrados.filter((r) => r.decision === "presente").length}
                </p>
                <p className="text-xs text-slate-500">Presentes</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl font-bold text-slate-400">{restantes}</p>
                <p className="text-xs text-slate-500">Sin marcar</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl font-bold text-white">{total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl border text-sm font-medium shadow-2xl animate-slide-up ${
            toast.tipo === "ok"
              ? "bg-emerald-900/95 border-emerald-500/30 text-emerald-200"
              : "bg-rose-900/95 border-rose-500/30 text-rose-200"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
