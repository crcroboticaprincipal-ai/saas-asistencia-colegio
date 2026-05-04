"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { CheckCircle, AlertTriangle, ScanLine, User, LogIn, LogOut } from "lucide-react";

type Estudiante = {
  id: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
};

export default function EscanerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | null, text: string }>({ type: null, text: "" });

  useEffect(() => {
    // Only init scanner if no result
    if (scanResult) return;

    let scanner: any;

    const initScanner = async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText: string) => {
          scanner.clear();
          setScanResult(decodedText);
          fetchEstudiante(decodedText);
        },
        (error: any) => {
          // Ignorar errores continuos de escaneo
        }
      );
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch((e: any) => console.error(e));
      }
    };
  }, [scanResult]);

  const fetchEstudiante = async (qrCode: string) => {
    setLoading(true);
    setMessage({ type: null, text: "" });
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

      if (error || !data) {
        throw new Error("Estudiante no encontrado o QR inválido.");
      }

      setEstudiante(data);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      setTimeout(() => resetScanner(), 3000);
    } finally {
      setLoading(false);
    }
  };

  const registerAsistencia = async (tipo: "ENTRADA" | "SALIDA") => {
    if (!estudiante) return;
    setLoading(true);
    
    try {
      const response = await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudiante_id: estudiante.id,
          tipo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar asistencia");
      }

      setMessage({ type: "success", text: `${tipo} registrada exitosamente. Notificación enviada.` });
      setTimeout(() => resetScanner(), 4000);

    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setEstudiante(null);
    setMessage({ type: null, text: "" });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in mt-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
          <ScanLine className="w-8 h-8 text-indigo-400" />
          Escáner de Acceso
        </h1>
        <p className="text-slate-400">Apunta el carnet del estudiante a la cámara</p>
      </div>

      {!scanResult ? (
        <div className="glass-panel p-4 rounded-3xl overflow-hidden border-2 border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
          <div id="reader" className="w-full rounded-2xl overflow-hidden [&>video]:rounded-2xl bg-black"></div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 space-y-8 animate-fade-in">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
              <p className="text-slate-300 font-medium">Buscando información...</p>
            </div>
          ) : estudiante ? (
            <>
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                  <User className="w-10 h-10 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white uppercase">{estudiante.nombre_completo}</h2>
                  <p className="text-indigo-300 font-medium">{estudiante.grado} "{estudiante.seccion}"</p>
                  <p className="text-slate-400 text-sm mt-1">C.I: {estudiante.cedula}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => registerAsistencia("ENTRADA")}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all group"
                >
                  <LogIn className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="font-bold tracking-wide">ENTRADA</span>
                </button>
                
                <button
                  onClick={() => registerAsistencia("SALIDA")}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-all group"
                >
                  <LogOut className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="font-bold tracking-wide">SALIDA</span>
                </button>
              </div>
              
              <button onClick={resetScanner} className="w-full py-3 text-slate-400 hover:text-white transition-colors text-sm font-medium">
                Cancelar y escanear otro
              </button>
            </>
          ) : null}

          {message.type && (
            <div className={`p-4 rounded-xl flex items-center justify-center gap-3 text-center animate-fade-in ${
              message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              <p className="font-medium text-lg">{message.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
