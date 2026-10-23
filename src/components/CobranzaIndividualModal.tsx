"use client";

import { useState, useId } from "react";
import { 
  X, Mail, DollarSign, Calendar, AlertCircle, 
  CheckCircle, Loader2, User, Sparkles, AlertTriangle 
} from "lucide-react";

const MESES_CICLO_ESCOLAR = [
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
];

export interface StudentForCobranza {
  id: string;
  nombre_completo: string;
  cedula: string;
  grado: string;
  seccion: string;
  nombre_representante?: string | null;
  correo_representante?: string | null;
  institucion_id?: string | null;
  foto_url?: string | null;
}

interface CobranzaIndividualModalProps {
  student: StudentForCobranza;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CobranzaIndividualModal({
  student,
  isOpen,
  onClose,
  onSuccess,
}: CobranzaIndividualModalProps) {
  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>([]);
  const [conceptoAdicional, setConceptoAdicional] = useState("");
  const [montoCuotas, setMontoCuotas] = useState<string>("");
  const [montoMora, setMontoMora] = useState<string>("0");
  const [correoDestino, setCorreoDestino] = useState<string>(student.correo_representante || "");
  const [nombreRepresentante, setNombreRepresentante] = useState<string>(
    student.nombre_representante || "Representante"
  );
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseInputId = useId();

  if (!isOpen) return null;

  // Toggle selection of months
  const toggleMes = (mes: string) => {
    setMesesSeleccionados((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes]
    );
  };

  const seleccionarTodosLosMeses = () => {
    setMesesSeleccionados([...MESES_CICLO_ESCOLAR]);
  };

  const limpiarMeses = () => {
    setMesesSeleccionados([]);
  };

  const seleccionarMesActual = () => {
    const mesesIndexMap: Record<number, string> = {
      8: "Septiembre",
      9: "Octubre",
      10: "Noviembre",
      11: "Diciembre",
      0: "Enero",
      1: "Febrero",
      2: "Marzo",
      3: "Abril",
      4: "Mayo",
      5: "Junio",
      6: "Julio",
    };
    const mesActual = mesesIndexMap[new Date().getMonth()];
    if (mesActual) {
      setMesesSeleccionados([mesActual]);
    }
  };

  // Live calculation
  const cuotasNum = parseFloat(montoCuotas) || 0;
  const moraNum = parseFloat(montoMora) || 0;
  const totalCalculado = Math.max(0, cuotasNum + moraNum);

  // Concept text construction
  const partesConcepto: string[] = [];
  if (mesesSeleccionados.length > 0) {
    partesConcepto.push(`Cuotas: ${mesesSeleccionados.join(", ")}`);
  }
  if (conceptoAdicional.trim()) {
    partesConcepto.push(conceptoAdicional.trim());
  }
  const conceptoFinal = partesConcepto.length > 0 ? partesConcepto.join(" · ") : "Mensualidad Escolar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const emailTrim = correoDestino.trim().toLowerCase();
    if (!emailTrim || !emailTrim.includes("@")) {
      setStatusMsg({ type: "error", text: "Por favor ingresa un correo de representante válido." });
      return;
    }

    if (cuotasNum <= 0) {
      setStatusMsg({ type: "error", text: "El monto de cuotas debe ser mayor a 0 USD." });
      return;
    }

    if (mesesSeleccionados.length === 0 && !conceptoAdicional.trim()) {
      setStatusMsg({
        type: "error",
        text: "Selecciona al menos un mes vencido o especifica un concepto (ej. Matrícula).",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/admin/cobranzas/enviar-individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: emailTrim,
          nombreEstudiante: student.nombre_completo,
          nombreRepresentante: nombreRepresentante.trim(),
          grado: student.grado,
          seccion: student.seccion,
          conceptoMeses: conceptoFinal,
          montoCuotas: cuotasNum,
          montoMora: moraNum,
          observacion: observacion.trim(),
          institucion_id: student.institucion_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo despachar el correo de cobranza.");
      }

      setStatusMsg({
        type: "success",
        text: `✅ Notificación enviada con éxito a ${emailTrim}.`,
      });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al enviar correo.";
      setStatusMsg({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-slide-up">
        
        {/* Header con estilo institucional */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Notificación de Saldo Pendiente
              </h2>
              <p className="text-xs text-slate-400">
                Aviso administrativo institucional por correo electrónico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 text-xs sm:text-sm">
          
          {/* Ficha Resumida del Alumno */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold flex-shrink-0">
                {student.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm truncate uppercase">
                  {student.nombre_completo}
                </p>
                <p className="text-xs text-slate-400">
                  {student.grado} &ldquo;{student.seccion}&rdquo; · CI: {student.cedula}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
              Cobranza
            </span>
          </div>

          {/* Datos del Representante y Correo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Nombre del Representante
              </label>
              <input
                type="text"
                value={nombreRepresentante}
                onChange={(e) => setNombreRepresentante(e.target.value)}
                placeholder="Nombre y Apellido"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Correo Destinatario</span>
                {!correoDestino && (
                  <span className="text-rose-400 text-[10px] font-bold">¡Requerido!</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={correoDestino}
                  onChange={(e) => setCorreoDestino(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Selector de Meses Vencidos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Cuotas / Meses Vencidos (2026–2027)
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={seleccionarMesActual}
                  className="text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Mes Actual
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={seleccionarTodosLosMeses}
                  className="text-slate-400 hover:text-white font-medium"
                >
                  Todos
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={limpiarMeses}
                  className="text-rose-400 hover:text-rose-300 font-medium"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Grid de Checkboxes de meses */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-950/60 border border-white/5">
              {MESES_CICLO_ESCOLAR.map((mes) => {
                const isSelected = mesesSeleccionados.includes(mes);
                return (
                  <button
                    key={mes}
                    type="button"
                    onClick={() => toggleMes(mes)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border text-center ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border-white/5 hover:border-white/10"
                    }`}
                  >
                    {mes}
                  </button>
                );
              })}
            </div>

            {/* Concepto adicional opcional */}
            <div className="pt-1">
              <input
                type="text"
                value={conceptoAdicional}
                onChange={(e) => setConceptoAdicional(e.target.value)}
                placeholder="Concepto adicional o libre (ej: Matrícula, Constancia, Seguro escolar)"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Inputs Financieros Dinámicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${baseInputId}-cuotas`} className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Monto Cuotas ($ USD) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-500 font-bold">$</span>
                <input
                  id={`${baseInputId}-cuotas`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montoCuotas}
                  onChange={(e) => setMontoCuotas(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${baseInputId}-mora`} className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Intereses Mora / Recargo ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-500 font-bold">$</span>
                <input
                  id={`${baseInputId}-mora`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoMora}
                  onChange={(e) => setMontoMora(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            </div>
          </div>

          {/* Cálculo en vivo: Tarjeta Bento de Resumen */}
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900 to-indigo-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Concepto:</span>
              <span className="font-semibold text-white max-w-[280px] truncate text-right">
                {conceptoFinal}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Subtotal Cuotas:</span>
              <span className="font-mono text-slate-200">${cuotasNum.toFixed(2)} USD</span>
            </div>
            {moraNum > 0 && (
              <div className="flex items-center justify-between text-xs text-rose-300">
                <span>Recargo por Mora:</span>
                <span className="font-mono text-rose-300">+${moraNum.toFixed(2)} USD</span>
              </div>
            )}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="font-bold text-amber-300 text-xs uppercase tracking-wider">
                Total a Notificar:
              </span>
              <span className="text-xl font-black font-mono text-white tracking-tight">
                ${totalCalculado.toFixed(2)} <span className="text-xs text-amber-300 font-bold">USD</span>
              </span>
            </div>
          </div>

          {/* Observación opcional */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Observación Adicional (Opcional)
            </label>
            <textarea
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Agradecemos remitir soporte de transferencia con su número de referencia..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-none"
            />
          </div>

          {/* Feedback status message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
                statusMsg.type === "success"
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/15 border border-rose-500/30 text-rose-300"
              }`}
            >
              {statusMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || cuotasNum <= 0 || !correoDestino}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Despachando Correo…</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Enviar Notificación</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
