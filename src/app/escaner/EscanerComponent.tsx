"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { CheckCircle, AlertTriangle, ScanLine, User, LogIn, LogOut, RotateCcw } from "lucide-react";

type Estudiante = {
  id: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
};

type ScanMode = "ENTRADA" | "SALIDA" | null;

export default function EscanerPage() {
  const [mode, setMode] = useState<ScanMode>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });
  const scannerRef = useRef<any>(null);

  // Init scanner only after mode is selected and no result yet
  useEffect(() => {
    if (!mode || scanResult) return;

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
          // Ignore continuous scan errors
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
  }, [mode, scanResult]);

  const processScannedCode = async (qrCode: string) => {
    setLoading(true);
    setMessage({ type: null, text: "" });
    try {
      // 1. Find student
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

      if (error || !data) {
        throw new Error("Estudiante no encontrado. QR inválido.");
      }

      setEstudiante(data);

      // 2. Auto-register with selected mode
      const response = await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudiante_id: data.id,
          tipo: mode,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Error al registrar asistencia");
      }

      setMessage({ 
        type: "success", 
        text: `${mode} registrada para ${data.nombre_completo}` 
      });

      // Auto-reset faster to scan next student
      setTimeout(() => {
        setScanResult(null);
        setEstudiante(null);
        setMessage({ type: null, text: "" });
      }, 1500);

    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      setTimeout(() => {
        setScanResult(null);
        setEstudiante(null);
        setMessage({ type: null, text: "" });
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setMode(null);
    setScanResult(null);
    setEstudiante(null);
    setMessage({ type: null, text: "" });
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  };

  // ── STEP 1: Select mode (ENTRADA or SALIDA) ──
  if (!mode) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-slide-up px-4 mt-6 sm:mt-10">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/15 rounded-2xl flex items-center justify-center border border-blue-500/25 mx-auto animate-glow">
            <ScanLine className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Qrono Scanner
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Selecciona el tipo de registro antes de escanear
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("ENTRADA")}
            className="group flex flex-col items-center justify-center gap-4 p-8 sm:p-10 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border-2 border-blue-500/25 hover:border-blue-400/50 text-blue-400 transition-all duration-300 active:scale-[0.97]"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/15 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <LogIn className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg sm:text-xl tracking-wide block">ENTRADA</span>
              <span className="text-xs text-blue-400/60 mt-1 block">Registrar llegada</span>
            </div>
          </button>
          
          <button
            onClick={() => setMode("SALIDA")}
            className="group flex flex-col items-center justify-center gap-4 p-8 sm:p-10 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/25 hover:border-red-400/50 text-red-400 transition-all duration-300 active:scale-[0.97]"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/15 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <LogOut className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg sm:text-xl tracking-wide block">SALIDA</span>
              <span className="text-xs text-red-400/60 mt-1 block">Registrar salida</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: Scanning ──
  return (
    <div className="max-w-lg mx-auto space-y-4 animate-fade-in px-4 mt-4 sm:mt-8">
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
            <p className="text-[11px] sm:text-xs text-slate-500">Escanea el carnet del estudiante</p>
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
        <div className={`glass-panel p-3 sm:p-4 rounded-2xl overflow-hidden border-2 shadow-2xl ${
          mode === "ENTRADA" 
            ? "border-blue-500/20 shadow-blue-500/10" 
            : "border-red-500/20 shadow-red-500/10"
        }`}>
          <div id="reader" className="w-full rounded-xl overflow-hidden [&>video]:rounded-xl bg-black"></div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 animate-slide-up">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className={`animate-spin w-10 h-10 border-4 rounded-full border-t-transparent ${
                mode === "ENTRADA" ? "border-blue-500" : "border-red-500"
              }`} />
              <p className="text-slate-300 font-medium text-sm">Registrando {mode.toLowerCase()}...</p>
            </div>
          ) : estudiante ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border ${
                mode === "ENTRADA" 
                  ? "bg-blue-500/15 border-blue-500/30" 
                  : "bg-red-500/15 border-red-500/30"
              }`}>
                <User className={`w-8 h-8 sm:w-10 sm:h-10 ${mode === "ENTRADA" ? "text-blue-400" : "text-red-400"}`} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase">{estudiante.nombre_completo}</h2>
                <p className={`font-medium mt-1 ${mode === "ENTRADA" ? "text-blue-300" : "text-red-300"}`}>
                  {estudiante.grado} &ldquo;{estudiante.seccion}&rdquo;
                </p>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">C.I: {estudiante.cedula}</p>
              </div>
            </div>
          ) : null}

          {/* Message */}
          {message.type && (
            <div className={`p-4 rounded-xl flex items-center justify-center gap-3 text-center animate-slide-up ${
              message.type === 'success' 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' 
                : 'bg-red-500/15 text-red-400 border border-red-500/25'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-6 h-6 flex-shrink-0" /> : <AlertTriangle className="w-6 h-6 flex-shrink-0" />}
              <p className="font-semibold text-sm sm:text-base">{message.text}</p>
            </div>
          )}

          {message.type === "success" && (
            <p className="text-center text-xs text-slate-500 animate-fade-in">
              Escaneando siguiente en unos segundos...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
