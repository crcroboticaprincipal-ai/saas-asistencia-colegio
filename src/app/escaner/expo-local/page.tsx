"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  User,
  QrCode,
  CheckCircle,
  Mail,
  Users,
  Camera,
  Keyboard,
  ArrowLeft,
  Terminal,
  Zap,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface EstudianteDemo {
  id: string;
  nombre: string;
  cedula: string;
  correo: string;
  qr_code: string;
  registro_asistencia?: string;
}

interface NotificationSim {
  id: string;
  nombre: string;
  correo: string;
  hora: string;
}

export default function ExpoLocalPage() {
  const [estudiantesDemo, setEstudiantesDemo] = useState<EstudianteDemo[]>([
    {
      id: "29999999",
      nombre: "ORLANDO GÓMEZ",
      cedula: "29999999",
      correo: "orlando.gomez@ejemplo.com",
      qr_code: "RC-29999999",
    },
    {
      id: "30111222",
      nombre: "VALENTINA CASTRO",
      cedula: "30111222",
      correo: "valentina@ejemplo.com",
      qr_code: "RC-30111222",
    }
  ]);

  // Form states
  const [nombreInput, setNombreInput] = useState("");
  const [cedulaInput, setCedulaInput] = useState("");
  const [correoInput, setCorreoInput] = useState("");
  const [currentCredencial, setCurrentCredencial] = useState<EstudianteDemo | null>(null);

  // Scanner states
  const [manualInput, setManualInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [successBlink, setSuccessBlink] = useState(false);
  const [lastScanned, setLastScanned] = useState<EstudianteDemo | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState<NotificationSim[]>([]);
  const [activeNotification, setActiveNotification] = useState<NotificationSim | null>(null);

  // Web Audio Context for Beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note - crisp & clean
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      console.warn("AudioContext block:", e);
    }
  };

  // HTML5 QR Code hook
  const processingRef = useRef(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!showScanner) return;

    let scanner: any;

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        scanner = new Html5QrcodeScanner(
          "expo-reader",
          {
            fps: 15,
            qrbox: { width: 180, height: 180 },
            aspectRatio: 1,
            rememberLastUsedCamera: true,
            supportedScanTypes: [],
          },
          false
        );

        scanner.render(
          (decodedText: string) => {
            if (processingRef.current) return;
            processingRef.current = true;
            handleProcessCode(decodedText);
            
            // Allow scanner to read again after 1.8s
            setTimeout(() => {
              processingRef.current = false;
            }, 1800);
          },
          () => {}
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error("Scanner init error:", err);
      }
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [showScanner]);

  // Processes code (either from QR scanner or keyboard)
  const handleProcessCode = (code: string) => {
    // Normalization
    const raw = code.trim().toUpperCase();
    const cleanNumber = raw.replace(/^(RC-|QR-|V-|E-)/, "").replace(/[^0-9]/g, "");

    // Search only in local state array
    const match = estudiantesDemo.find(
      (e) =>
        e.qr_code.toUpperCase() === raw ||
        e.cedula === cleanNumber ||
        e.cedula === raw
    );

    if (match) {
      playBeep();
      setSuccessBlink(true);
      setLastScanned(match);
      setShowBanner(true);

      // Register timestamp in local copy
      setEstudiantesDemo((prev) =>
        prev.map((e) =>
          e.id === match.id
            ? { ...e, registro_asistencia: new Date().toLocaleTimeString("es-VE", { hour12: true }) }
            : e
        )
      );

      // Fire floating notification animation
      const newNotif: NotificationSim = {
        id: Math.random().toString(),
        nombre: match.nombre,
        correo: match.correo,
        hora: new Date().toLocaleTimeString("es-VE", { hour12: true })
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setActiveNotification(newNotif);

      setTimeout(() => {
        setSuccessBlink(false);
      }, 500);

      setTimeout(() => {
        setShowBanner(false);
      }, 3000);
    } else {
      alert(`⚠️ Código: "${code}" no encontrado en el arreglo de memoria local.`);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreInput || !cedulaInput || !correoInput) return;

    const cleanCedula = cedulaInput.trim().replace(/[^0-9]/g, "");
    const newEst: EstudianteDemo = {
      id: cleanCedula,
      nombre: nombreInput.trim().toUpperCase(),
      cedula: cleanCedula,
      correo: correoInput.trim().toLowerCase(),
      qr_code: `RC-${cleanCedula}`
    };

    // Add to local state array
    setEstudiantesDemo((prev) => [...prev, newEst]);
    setCurrentCredencial(newEst);

    // Clear inputs
    setNombreInput("");
    setCedulaInput("");
    setCorreoInput("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 selection:bg-orange-500 selection:text-black">
      {/* Background Cyberpunk grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-orange-500/20 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest bg-orange-500 text-black animate-pulse">
                STAND 4TO AÑO
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-blue-400">
                <Zap className="w-3.5 h-3.5 fill-current" /> VOLÁTIL EN MEMORIA
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-orange-400 bg-clip-text text-transparent">
              ASISTO PRO <span className="text-orange-500">EXPO</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl">
              Entorno aislado interactivo de demostración. Los datos no se envían a servidores ni afectan a la base de datos real.
            </p>
          </div>

          <Link
            href="/escaner"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/20 bg-slate-900/60 hover:bg-slate-900 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir de Simulación
          </Link>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Box 1: Formulario de Registro */}
          <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-blue-950/20 to-slate-900/40 border border-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/25">
                  <User className="w-4 h-4 text-orange-400" />
                </div>
                <h2 className="font-bold text-lg text-white">Registro de Visitantes</h2>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={nombreInput}
                    onChange={(e) => setNombreInput(e.target.value)}
                    placeholder="Ej. JUAN RAMÍREZ"
                    className="w-full bg-slate-950 border border-white/5 focus:border-orange-500/50 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Cédula</label>
                  <input
                    type="text"
                    required
                    value={cedulaInput}
                    onChange={(e) => setCedulaInput(e.target.value)}
                    placeholder="Ej. 30123456"
                    className="w-full bg-slate-950 border border-white/5 focus:border-orange-500/50 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={correoInput}
                    onChange={(e) => setCorreoInput(e.target.value)}
                    placeholder="Ej. juan@correo.com"
                    className="w-full bg-slate-950 border border-white/5 focus:border-orange-500/50 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-black rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-[0.98]"
                >
                  Generar Credencial
                </button>
              </form>
            </div>

            <div className="mt-6 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-[10px] text-orange-400/80 leading-relaxed">
              💡 Al generar, el visitante se añadirá a la lista de estudiantes simulada del stand y su credencial aparecerá a la derecha para ser escaneada.
            </div>
          </div>

          {/* Box 2: Credencial Generada */}
          <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-indigo-950/20 to-slate-900/40 border border-blue-500/10 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[350px]">
            {currentCredencial ? (
              <div className="w-full max-w-[280px] border border-blue-500/30 rounded-2xl p-5 bg-slate-900/60 shadow-2xl relative space-y-4 animate-fade-in">
                {/* School Header */}
                <div className="border-b border-blue-500/20 pb-2">
                  <h3 className="font-black text-xs text-blue-400 tracking-widest">UE COLEGIO RAFAEL CASTILLO</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">EXPOINNOVACIÓN 2026</p>
                </div>

                {/* QR Code Container */}
                <div className="flex justify-center py-2">
                  <div className="p-2.5 bg-white rounded-xl shadow-lg border-2 border-orange-500/20">
                    <QRCodeSVG value={currentCredencial.qr_code} size={130} level="H" includeMargin />
                  </div>
                </div>

                {/* Visitor Info */}
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-white uppercase tracking-wider truncate">
                    {currentCredencial.nombre}
                  </h4>
                  <p className="text-[10px] font-semibold text-slate-400">
                    C.I: {currentCredencial.cedula}
                  </p>
                  <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-black text-[9px] uppercase tracking-wider">
                    VISITANTE DE EXPO
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mx-auto text-slate-600">
                  <QrCode className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-sm">Esperando Registro...</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-[200px] mx-auto">
                    Completa el formulario de la izquierda para generar tu credencial interactiva.
                  </p>
                </div>
              </div>
            )}

            {/* Glowing accent dots */}
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
          </div>

          {/* Box 3: Escáner QR & Teclado */}
          <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-slate-900/40 to-indigo-950/20 border border-orange-500/10 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25">
                    <Camera className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="font-bold text-lg text-white">Escáner de Acceso</h2>
                </div>

                <button
                  onClick={() => setShowScanner(!showScanner)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showScanner
                      ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  }`}
                >
                  {showScanner ? "Apagar Cámara" : "Encender Cámara"}
                </button>
              </div>

              {/* Scanning screen */}
              {showScanner ? (
                <div className={`border-2 rounded-2xl overflow-hidden bg-black transition-all ${
                  successBlink ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "border-slate-800"
                }`}>
                  <div id="expo-reader" className="w-full overflow-hidden [&>video]:rounded-xl" />
                </div>
              ) : (
                <div className="border border-white/5 rounded-2xl bg-slate-950/80 p-8 text-center flex flex-col items-center justify-center h-48 space-y-2">
                  <Terminal className="w-6 h-6 text-slate-700" />
                  <p className="text-xs text-slate-500">
                    Cámara apagada. Usa el ingreso por teclado o enciéndela arriba.
                  </p>
                </div>
              )}

              {/* Keyboard fallback input */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Marcar por Cédula / Código</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ej. 30123456 o RC-30123456"
                    className="flex-1 bg-slate-950 border border-white/5 focus:border-orange-500/50 rounded-xl py-2 px-3 text-sm text-white focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleProcessCode(manualInput);
                        setManualInput("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      handleProcessCode(manualInput);
                      setManualInput("");
                    }}
                    className="px-4 bg-slate-900 border border-white/10 hover:border-orange-500/40 text-xs font-bold text-slate-300 hover:text-orange-400 rounded-xl transition-all"
                  >
                    Ingresar
                  </button>
                </div>
              </div>
            </div>

            {/* Banner Flotante Local */}
            {showBanner && lastScanned && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-2 text-xs font-bold animate-bounce shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>🟢 Entrada Registrada Localmente: {lastScanned.nombre}</span>
              </div>
            )}
          </div>

        </div>

        {/* Bottom Bento Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Box 4: Monitor Animado de Notificación */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-3xl bg-gradient-to-br from-indigo-950/20 to-slate-900/40 border border-blue-500/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/25">
                  <Mail className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="font-bold text-lg text-white">Monitor de Envío de Email</h2>
              </div>

              {activeNotification ? (
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3 relative overflow-hidden animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wider text-blue-400 uppercase">
                      ✉️ COLA DE CORREO (SIMULACIÓN)
                    </span>
                    <span className="text-[9px] text-slate-500">{activeNotification.hora}</span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">
                    Miembro del Colegio Rafael Castillo, se ha enviado un correo con membrete oficial a:
                  </p>
                  
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5">
                    <p className="text-xs font-bold text-white">{activeNotification.nombre}</p>
                    <p className="text-[10px] text-slate-500">{activeNotification.correo}</p>
                  </div>

                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
                    Simulación de despacho Resend completada.
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-600 text-xs italic">
                  Esperando registro de entrada para simular el envío del email a los representantes.
                </div>
              )}
            </div>

            {/* Notification logs list */}
            {notifications.length > 1 && (
              <div className="mt-4 border-t border-white/5 pt-3 space-y-1.5">
                <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LOGS DE SIMULACIÓN</p>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {notifications.slice(1, 4).map((n) => (
                    <div key={n.id} className="text-[10px] text-slate-500 truncate">
                      [{n.hora}] 📨 Notificación enviada a {n.correo} ({n.nombre})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Box 5: Estudiantes Registrados en Memoria */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl bg-gradient-to-br from-slate-900/40 to-blue-950/20 border border-orange-500/10 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/25">
                  <Users className="w-4 h-4 text-orange-400" />
                </div>
                <h2 className="font-bold text-lg text-white">Nómina Temporal (Memoria Volátil)</h2>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-black">
                    <tr>
                      <th className="px-4 py-3">Cédula</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Correo Representante</th>
                      <th className="px-4 py-3 text-right">Acceso Hoy (Simulado)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {estudiantesDemo.map((e) => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-400">{e.cedula}</td>
                        <td className="px-4 py-3 font-bold text-white uppercase">{e.nombre}</td>
                        <td className="px-4 py-3 text-slate-400">{e.correo}</td>
                        <td className="px-4 py-3 text-right">
                          {e.registro_asistencia ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] animate-fade-in">
                              🚪 {e.registro_asistencia}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">No registrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
              <Terminal className="w-3.5 h-3.5" />
              <span>Conteo local: {estudiantesDemo.length} registros cargados en el cliente.</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
