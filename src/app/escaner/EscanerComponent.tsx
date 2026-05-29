"use client";

import { useEffect, useState, useRef } from "react";
import {
  CheckCircle, AlertTriangle, ScanLine, User, LogIn, LogOut,
  RotateCcw, Briefcase, FileText, ArrowLeft, ChevronDown
} from "lucide-react";
import Image from "next/image";

type ScanMode = "ENTRADA" | "SALIDA" | "PASE" | null;
type TipoPase = "ENTRADA" | "SALIDA" | "ESPECIAL";

const MOTIVOS_PASE = [
  "Retraso por transporte",
  "Malestar de salud",
  "Autorización especial de uniforme",
  "Cita médica",
  "Trámite administrativo",
  "Otro",
];

type ScanResult =
  | { tipo_usuario: "estudiante"; nombre: string; grado: string; seccion: string; foto_url?: string | null }
  | { tipo_usuario: "personal"; nombre: string; cargo: string; rol: string }
  | { tipo_usuario: "pase"; nombre: string; grado: string; seccion: string; foto_url?: string | null; profesor_notificado?: { nombre: string } | null; tipo_pase: TipoPase; motivo?: string | null }
  | null;

export default function EscanerComponent() {
  const [mode, setMode] = useState<ScanMode>(null);
  const [tipoPase, setTipoPase] = useState<TipoPase>("ENTRADA");
  const [motivoPase, setMotivoPase] = useState<string>("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScanResult>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const scannerRef = useRef<any>(null);
  const [showCedulaInput, setShowCedulaInput] = useState(false);
  const [cedulaInput, setCedulaInput] = useState("");

  // Init scanner only after mode is selected and no result yet
  useEffect(() => {
    if (!mode || scanResult || showCedulaInput) return;

    let scanner: any;

    const initScanner = async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      scanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
          rememberLastUsedCamera: true,
        },
        false
      );

      scanner.render(
        (decodedText: string) => {
          scanner.clear();
          setScanResult(decodedText);
          processScannedCode(decodedText);
        },
        () => {
          // Ignore continuous scan errors silently
        }
      );

      scannerRef.current = scanner;
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scanResult]);

  const processScannedCode = async (qrCode: string) => {
    setLoading(true);
    setMessage({ type: null, text: "" });

    try {
      let response: Response;
      let data: any;

      if (mode === "PASE") {
        response = await fetch("/api/pases/registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode, tipo_pase: tipoPase, motivo: motivoPase || null }),
        });
        data = await response.json();

        if (!response.ok) throw new Error(data.error || "Error al procesar el pase");

        setScannedData({
          tipo_usuario: "pase",
          nombre: data.estudiante?.nombre || "Estudiante",
          grado: data.estudiante?.grado || "",
          seccion: data.estudiante?.seccion || "",
          foto_url: data.estudiante?.foto_url || null,
          profesor_notificado: data.profesor_notificado || null,
          tipo_pase: data.tipo_pase,
          motivo: data.motivo,
        });
        const tipoPaseLabel = tipoPase === "ENTRADA" ? "Entrada" : tipoPase === "SALIDA" ? "Salida" : "Especial";
        setMessage({ type: "success", text: `Pase de ${tipoPaseLabel} registrado para ${data.estudiante?.nombre}` });
      } else {
        response = await fetch("/api/escaner/validar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode, tipo: mode }),
        });
        data = await response.json();

        if (!response.ok) throw new Error(data.error || "Error al procesar el código QR");

        setScannedData({
          ...data,
          foto_url: data.foto_url || null,
        } as ScanResult);
        const nombre = data.nombre || "Persona";
        setMessage({ type: "success", text: `${mode} registrada para ${nombre}` });
      }

      setTimeout(() => {
        setScanResult(null);
        setScannedData(null);
        setMessage({ type: null, text: "" });
      }, 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      setTimeout(() => {
        setScanResult(null);
        setScannedData(null);
        setMessage({ type: null, text: "" });
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setMode(null);
    setScanResult(null);
    setScannedData(null);
    setMessage({ type: null, text: "" });
    setShowCedulaInput(false);
    setCedulaInput("");
    setMotivoPase("");
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  };

  const handleCedulaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cedulaInput.trim();
    if (!clean) return;
    setScanResult(clean);
    processScannedCode(clean);
    setShowCedulaInput(false);
  };

  // ── STEP 1: Select mode ──
  if (!mode) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-slide-up px-4 mt-6 sm:mt-10">
        <div className="text-center space-y-4">
          <div className="h-32 sm:h-36 flex items-center justify-center mx-auto overflow-hidden">
            <Image
              src="/logo.png"
              alt="Asisto Logo"
              width={353}
              height={157}
              className="w-auto h-full object-contain opacity-90"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Asisto Scanner
            </h1>
            <p className="text-slate-500 text-sm sm:text-base mt-1">
              Selecciona el tipo de registro antes de escanear
            </p>
          </div>
        </div>

        {/* Botones principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("ENTRADA")}
            id="btn-mode-entrada"
            className="group flex flex-col items-center justify-center gap-4 p-8 sm:p-10 rounded-2xl bg-blue-50/60 hover:bg-blue-100/80 border-2 border-blue-200/60 hover:border-blue-300 text-blue-600 shadow-md transition-all duration-300 active:scale-[0.97]"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100/70 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <LogIn className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg sm:text-xl tracking-wide block">ENTRADA</span>
              <span className="text-xs text-blue-500/80 mt-1 block font-medium">Registrar llegada</span>
            </div>
          </button>

          <button
            onClick={() => setMode("SALIDA")}
            id="btn-mode-salida"
            className="group flex flex-col items-center justify-center gap-4 p-8 sm:p-10 rounded-2xl bg-rose-50/60 hover:bg-rose-100/80 border-2 border-rose-200/60 hover:border-rose-300 text-rose-600 shadow-md transition-all duration-300 active:scale-[0.97]"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-100/70 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <LogOut className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg sm:text-xl tracking-wide block">SALIDA</span>
              <span className="text-xs text-rose-500/80 mt-1 block font-medium">Registrar salida</span>
            </div>
          </button>
        </div>

        {/* Sección de Pases */}
        <div className="border-t border-slate-200/60 pt-4">
          <p className="text-xs text-slate-400 text-center font-semibold uppercase tracking-wider mb-3 flex items-center justify-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Pases Digitales
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { tipo: "ENTRADA" as TipoPase, label: "Pase Entrada", color: "amber", icon: "🚪" },
              { tipo: "SALIDA" as TipoPase, label: "Pase Salida", color: "orange", icon: "🚶" },
              { tipo: "ESPECIAL" as TipoPase, label: "Pase Especial", color: "violet", icon: "⭐" },
            ].map(({ tipo, label, icon }) => (
              <button
                key={tipo}
                id={`btn-pase-${tipo.toLowerCase()}`}
                onClick={() => { setTipoPase(tipo); setMode("PASE"); }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200/60 hover:border-amber-300 text-amber-700 shadow-sm transition-all duration-200 active:scale-[0.97]"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-semibold text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: Configurar pase (selector de motivo) ──
  if (mode === "PASE" && !scanResult) {
    return (
      <div className="max-w-lg mx-auto space-y-4 animate-fade-in px-4 mt-4 sm:mt-8">
        {/* Header */}
        <div className="flex justify-center mb-2">
          <div className="h-16 sm:h-20 flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Asisto Logo" width={235} height={78} className="w-auto h-full object-contain opacity-80" priority />
          </div>
        </div>

        {/* Tipo de pase indicator */}
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base text-amber-300">
                Pase de {tipoPase === "ENTRADA" ? "Entrada" : tipoPase === "SALIDA" ? "Salida" : "Especial"}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-500">Registro de incidencia</p>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cambiar
          </button>
        </div>

        {/* Selector de tipo de pase */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <p className="text-xs font-semibold text-slate-400 mb-3">Tipo de pase</p>
          <div className="flex gap-2">
            {(["ENTRADA", "SALIDA", "ESPECIAL"] as TipoPase[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipoPase(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  tipoPase === t
                    ? "bg-amber-500 text-white"
                    : "bg-slate-800/40 text-slate-400 hover:text-white"
                }`}
              >
                {t === "ENTRADA" ? "🚪 Entrada" : t === "SALIDA" ? "🚶 Salida" : "⭐ Especial"}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de motivo */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <label className="text-xs font-semibold text-slate-400 mb-2 block">
            Motivo del pase
          </label>
          <div className="relative">
            <select
              value={motivoPase}
              onChange={(e) => setMotivoPase(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 appearance-none"
            >
              <option value="">Seleccionar motivo…</option>
              {MOTIVOS_PASE.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Escáner QR o cédula */}
        {showCedulaInput ? (
          <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl text-center space-y-4">
            <p className="text-sm font-semibold text-white">⌨️ Marcar por Cédula / ID</p>
            <form onSubmit={handleCedulaSubmit} className="max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Ej: V-12345678"
                value={cedulaInput}
                onChange={(e) => setCedulaInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-center text-xl font-bold tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                autoFocus
              />
              <button
                type="submit"
                className="mt-3 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold transition-all"
              >
                Registrar Pase
              </button>
            </form>
          </div>
        ) : (
          <div className="glass-panel p-3 sm:p-4 rounded-2xl overflow-hidden border-2 shadow-2xl border-amber-500/20 shadow-amber-500/10">
            <div id="reader" className="w-full rounded-xl overflow-hidden [&>video]:rounded-xl bg-black" />
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => {
              setShowCedulaInput(!showCedulaInput);
              setCedulaInput("");
              if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
              }
            }}
            className="px-4 py-2 bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-2"
          >
            {showCedulaInput ? "📷 Volver al Escáner QR" : "⌨️ Marcar por Cédula / ID"}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3: Scanning (ENTRADA/SALIDA normal) ──
  return (
    <div className="max-w-lg mx-auto space-y-4 animate-fade-in px-4 mt-4 sm:mt-8">
      {/* Header con logo */}
      <div className="flex justify-center mb-2">
        <div className="h-16 sm:h-20 flex items-center justify-center overflow-hidden">
          <Image
            src="/logo.png"
            alt="Asisto Logo"
            width={235}
            height={78}
            className="w-auto h-full object-contain opacity-80"
            priority
          />
        </div>
      </div>

      {/* Mode indicator bar */}
      <div className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 ${
        mode === "ENTRADA"
          ? "bg-blue-500/10 border-blue-500/30"
          : "bg-red-500/10 border-red-500/30"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${mode === "ENTRADA" ? "bg-blue-500/20" : "bg-red-500/20"}`}>
            {mode === "ENTRADA" ? <LogIn className="w-5 h-5 text-blue-400" /> : <LogOut className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <p className={`font-bold text-sm sm:text-base ${mode === "ENTRADA" ? "text-blue-300" : "text-red-300"}`}>
              Modo: {mode}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500">Escanea el carnet del estudiante o empleado</p>
          </div>
        </div>
        <button
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cambiar</span>
        </button>
      </div>

      {/* Scanner or Result */}
      {!scanResult ? (
        <div className="space-y-4">
          {showCedulaInput ? (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl text-center space-y-4">
              <p className="text-sm font-semibold text-white">⌨️ Marcar por Cédula / ID</p>
              <form onSubmit={handleCedulaSubmit} className="max-w-xs mx-auto">
                <input
                  type="text"
                  placeholder="Ej: V-12345678"
                  value={cedulaInput}
                  onChange={(e) => setCedulaInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-center text-xl font-bold tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
                <button
                  type="submit"
                  className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Procesar Asistencia
                </button>
              </form>
            </div>
          ) : (
            <div className={`glass-panel p-3 sm:p-4 rounded-2xl overflow-hidden border-2 shadow-2xl ${
              mode === "ENTRADA"
                ? "border-blue-500/20 shadow-blue-500/10"
                : "border-red-500/20 shadow-red-500/10"
            }`}>
              <div id="reader" className="w-full rounded-xl overflow-hidden [&>video]:rounded-xl bg-black" />
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={() => {
                setShowCedulaInput(!showCedulaInput);
                setCedulaInput("");
                if (scannerRef.current) {
                  scannerRef.current.clear().catch(() => {});
                  scannerRef.current = null;
                }
              }}
              className="px-4 py-2 bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-2"
            >
              {showCedulaInput ? "📷 Volver al Escáner QR" : "⌨️ Marcar por Cédula / ID"}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5 animate-slide-up">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className={`animate-spin w-10 h-10 border-4 rounded-full border-t-transparent ${
                mode === "ENTRADA" ? "border-blue-500" : "border-red-500"
              }`} />
              <p className="text-slate-300 font-medium text-sm">Registrando {mode?.toLowerCase()}…</p>
            </div>
          ) : scannedData ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in">
              {/* Foto del estudiante si existe */}
              {(scannedData.tipo_usuario === "estudiante" || scannedData.tipo_usuario === "pase") && scannedData.foto_url ? (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-4 border-white/20 shadow-xl">
                  <Image
                    src={scannedData.foto_url}
                    alt={scannedData.nombre}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border ${
                  scannedData.tipo_usuario === "personal"
                    ? "bg-emerald-500/15 border-emerald-500/30"
                    : scannedData.tipo_usuario === "pase"
                    ? "bg-amber-500/15 border-amber-500/30"
                    : mode === "ENTRADA"
                    ? "bg-blue-500/15 border-blue-500/30"
                    : "bg-red-500/15 border-red-500/30"
                }`}>
                  {scannedData.tipo_usuario === "personal"
                    ? <Briefcase className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400" />
                    : scannedData.tipo_usuario === "pase"
                    ? <FileText className="w-9 h-9 sm:w-11 sm:h-11 text-amber-400" />
                    : <User className={`w-9 h-9 sm:w-11 sm:h-11 ${mode === "ENTRADA" ? "text-blue-400" : "text-red-400"}`} />
                  }
                </div>
              )}

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{scannedData.nombre}</h2>
                {scannedData.tipo_usuario === "estudiante" && (
                  <>
                    <p className={`font-medium mt-1 ${mode === "ENTRADA" ? "text-blue-300" : "text-red-300"}`}>
                      {scannedData.grado} &ldquo;{scannedData.seccion}&rdquo;
                    </p>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">Estudiante</p>
                  </>
                )}
                {scannedData.tipo_usuario === "personal" && (
                  <>
                    <p className="font-medium mt-1 text-emerald-300">{scannedData.cargo}</p>
                    <p className="text-emerald-400/80 font-semibold text-xs sm:text-sm mt-1">Personal</p>
                  </>
                )}
                {scannedData.tipo_usuario === "pase" && (
                  <>
                    <p className="font-medium mt-1 text-amber-300">
                      {scannedData.grado} &ldquo;{scannedData.seccion}&rdquo;
                    </p>
                    <p className="text-amber-400/80 font-semibold text-xs sm:text-sm mt-1">
                      Pase de {scannedData.tipo_pase === "ENTRADA" ? "Entrada" : scannedData.tipo_pase === "SALIDA" ? "Salida" : "Especial"}
                    </p>
                    {scannedData.motivo && (
                      <p className="text-slate-400 text-xs mt-1">Motivo: {scannedData.motivo}</p>
                    )}
                    {scannedData.profesor_notificado && (
                      <p className="text-emerald-400 text-xs mt-1">
                        ✅ Profesor notificado: {scannedData.profesor_notificado.nombre}
                      </p>
                    )}
                    {!scannedData.profesor_notificado && (
                      <p className="text-slate-500 text-xs mt-1">Sin bloque activo en este horario</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Message */}
          {message.type && (
            <div className={`p-4 rounded-xl flex items-center justify-center gap-3 text-center animate-slide-up ${
              message.type === "success"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "bg-red-500/15 text-red-400 border border-red-500/25"
            }`}>
              {message.type === "success"
                ? <CheckCircle className="w-6 h-6 flex-shrink-0" />
                : <AlertTriangle className="w-6 h-6 flex-shrink-0" />}
              <p className="font-semibold text-sm sm:text-base">{message.text}</p>
            </div>
          )}

          {message.type === "success" && (
            <p className="text-center text-xs text-slate-500 animate-fade-in">
              Escaneando siguiente en unos segundos…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
