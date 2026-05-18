"use client";

import { useState, useEffect } from "react";
import {
  X, Save, Loader2, Plus, Trash2, BookOpen, Clock,
  Calendar, ChevronDown, ChevronUp, AlertCircle, CheckCircle,
} from "lucide-react";
import type { Personal } from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bloque {
  dia_semana: number;
  hora_entrada_esperada: string;
  hora_salida_esperada: string;
  tolerancia_entrada_min: number;
  tolerancia_salida_min: number;
  descripcion: string;
}

interface Asignacion {
  materia_id: string;
  grado: string;
  seccion: string;
  dia_semana: number | "";
  hora_inicio: string;
  hora_fin: string;
}

interface Materia { id: string; nombre: string; codigo: string | null; }

const DIAS = [
  { num: 1, label: "Lunes" },
  { num: 2, label: "Martes" },
  { num: 3, label: "Miércoles" },
  { num: 4, label: "Jueves" },
  { num: 5, label: "Viernes" },
  { num: 6, label: "Sábado" },
  { num: 7, label: "Domingo" },
];

const GRADOS = [
  "1er Grado","2do Grado","3er Grado","4to Grado","5to Grado","6to Grado",
  "7mo (1er Año)","8vo (2do Año)","9no (3er Año)","10mo (4to Año)","11mo (5to Año)",
];
const SECCIONES = ["A","B","C","D","E","F"];

const BLOQUE_EMPTY = (dia: number): Bloque => ({
  dia_semana: dia,
  hora_entrada_esperada: "07:00",
  hora_salida_esperada: "14:00",
  tolerancia_entrada_min: 10,
  tolerancia_salida_min: 15,
  descripcion: "",
});

const ASIG_EMPTY: Asignacion = {
  materia_id: "", grado: "", seccion: "", dia_semana: "", hora_inicio: "07:00", hora_fin: "08:00",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GestorDocenteModal({
  personal,
  onClose,
}: {
  personal: Personal;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"horario" | "academico">("horario");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Horario state
  const [diasActivos, setDiasActivos] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bloques, setBloques] = useState<Bloque[]>([
    BLOQUE_EMPTY(1), BLOQUE_EMPTY(2), BLOQUE_EMPTY(3), BLOQUE_EMPTY(4), BLOQUE_EMPTY(5),
  ]);
  const [expandedDia, setExpandedDia] = useState<number | null>(1);

  // Académico state
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([{ ...ASIG_EMPTY }]);

  // Load existing data
  useEffect(() => {
    fetch(`/api/admin/docente/horario?personal_id=${personal.id}`)
      .then((r) => r.json())
      .then(({ plantillas, asignaciones: asigs, materias: mats }) => {
        if (mats?.length) setMaterias(mats);

        // Rebuild bloques from existing data
        if (plantillas?.length) {
          const allBloques: Bloque[] = plantillas
            .filter((p: { activo: boolean }) => p.activo)
            .flatMap((p: { horarios_bloques: Bloque[] }) => p.horarios_bloques ?? []);
          if (allBloques.length) {
            setBloques(allBloques);
            const dias = [...new Set(allBloques.map((b) => b.dia_semana))];
            setDiasActivos(dias);
          }
        }

        if (asigs?.length) {
          setAsignaciones(asigs.map((a: Asignacion & { materia_id: string }) => ({
            materia_id: a.materia_id,
            grado: a.grado,
            seccion: a.seccion,
            dia_semana: a.dia_semana ?? "",
            hora_inicio: a.hora_inicio,
            hora_fin: a.hora_fin,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [personal.id]);

  // ── Helpers: Bloques ──────────────────────────────────────────────────────

  const toggleDia = (dia: number) => {
    if (diasActivos.includes(dia)) {
      setDiasActivos((prev) => prev.filter((d) => d !== dia));
      setBloques((prev) => prev.filter((b) => b.dia_semana !== dia));
    } else {
      setDiasActivos((prev) => [...prev, dia].sort((a, b) => a - b));
      setBloques((prev) => [...prev, BLOQUE_EMPTY(dia)]);
    }
  };

  const addBloque = (dia: number) => {
    setBloques((prev) => [...prev, { ...BLOQUE_EMPTY(dia), descripcion: `Bloque ${bloquesDelDia(dia).length + 1}` }]);
  };

  const removeBloque = (dia: number, idx: number) => {
    const diaB = bloquesDelDia(dia);
    if (diaB.length <= 1) return; // Keep at least 1
    let count = 0;
    setBloques((prev) => prev.filter((b) => {
      if (b.dia_semana !== dia) return true;
      return count++ !== idx;
    }));
  };

  const updateBloque = (dia: number, idx: number, field: keyof Bloque, value: string | number) => {
    let diaCount = 0;
    setBloques((prev) => prev.map((b) => {
      if (b.dia_semana !== dia) return b;
      if (diaCount++ === idx) return { ...b, [field]: value };
      return b;
    }));
  };

  const bloquesDelDia = (dia: number) => bloques.filter((b) => b.dia_semana === dia);

  // ── Helpers: Asignaciones ─────────────────────────────────────────────────

  const addAsig = () => setAsignaciones((prev) => [...prev, { ...ASIG_EMPTY }]);
  const removeAsig = (idx: number) => setAsignaciones((prev) => prev.filter((_, i) => i !== idx));
  const updateAsig = (idx: number, field: keyof Asignacion, value: string | number) =>
    setAsignaciones((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Need institucion_id — fetch from personal data (it's in the Personal type)
      const res = await fetch("/api/admin/docente/horario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal_id: personal.id,
          institucion_id: personal.institucion_id,
          plantilla: { nombre: "Horario Principal", tipo: bloques.some((b, i, a) => a.filter(x => x.dia_semana === b.dia_semana).length > 1) ? "fraccionado" : "fijo" },
          bloques,
          asignaciones: asignaciones.filter((a) => a.materia_id && a.grado && a.seccion),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Configuración guardada exitosamente.");
      setTimeout(() => { setSuccess(""); onClose(); }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-white/[0.08] shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Panel del Docente</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {personal.nombres} {personal.apellidos}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(["horario", "academico"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                tab === t
                  ? "text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/5"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {t === "horario" ? <><Clock className="w-4 h-4" /> Horario Laboral</> : <><BookOpen className="w-4 h-4" /> Carga Académica</>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : tab === "horario" ? (

            // ── TAB 1: HORARIO ──────────────────────────────────────────────
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Selecciona los días laborables. Los días <span className="text-slate-300">no marcados</span> se registran como <em>días libres</em> (sin evaluación de retardo). Puedes añadir múltiples bloques por día para horarios fraccionados.
              </p>

              {/* Day toggles */}
              <div className="flex flex-wrap gap-2">
                {DIAS.map(({ num, label }) => (
                  <button
                    key={num}
                    onClick={() => toggleDia(num)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      diasActivos.includes(num)
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                        : "bg-slate-800/50 text-slate-500 border-white/5 hover:border-white/15"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Bloques por día */}
              <div className="space-y-3">
                {DIAS.filter((d) => diasActivos.includes(d.num)).map(({ num, label }) => (
                  <div key={num} className="glass-card rounded-xl border border-white/[0.06] overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => setExpandedDia(expandedDia === num ? null : num)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">{label}</span>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                          {bloquesDelDia(num).length} bloque{bloquesDelDia(num).length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {expandedDia === num ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {expandedDia === num && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        {bloquesDelDia(num).map((bloque, idx) => (
                          <div key={idx} className="bg-slate-800/40 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-400">
                                {bloque.descripcion || `Bloque ${idx + 1}`}
                              </span>
                              {bloquesDelDia(num).length > 1 && (
                                <button onClick={() => removeBloque(num, idx)} className="text-slate-600 hover:text-rose-400 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: "Entrada", field: "hora_entrada_esperada" as const },
                                { label: "Salida", field: "hora_salida_esperada" as const },
                              ].map(({ label: lbl, field }) => (
                                <div key={field}>
                                  <label className="block text-[10px] text-slate-500 mb-1">{lbl}</label>
                                  <input
                                    type="time"
                                    value={bloque[field] as string}
                                    onChange={(e) => updateBloque(num, idx, field, e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                </div>
                              ))}
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Tolerancia entrada (min)</label>
                                <input
                                  type="number" min={0} max={60}
                                  value={bloque.tolerancia_entrada_min}
                                  onChange={(e) => updateBloque(num, idx, "tolerancia_entrada_min", Number(e.target.value))}
                                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">Descripción (opcional)</label>
                                <input
                                  type="text"
                                  placeholder="ej: Turno mañana"
                                  value={bloque.descripcion}
                                  onChange={(e) => updateBloque(num, idx, "descripcion", e.target.value)}
                                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => addBloque(num)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400 text-xs hover:bg-indigo-500/10 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" /> Añadir bloque al {label}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {diasActivos.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-6">Selecciona al menos un día laborable.</p>
              )}
            </div>

          ) : (

            // ── TAB 2: CARGA ACADÉMICA ─────────────────────────────────────
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Asigna las clases que dicta este docente. Cada fila define materia, grado, sección y horario. El escáner del aula mostrará únicamente estas asignaciones.
              </p>

              <div className="space-y-3">
                {asignaciones.map((asig, idx) => (
                  <div key={idx} className="bg-slate-800/40 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400">Clase {idx + 1}</span>
                      {asignaciones.length > 1 && (
                        <button onClick={() => removeAsig(idx)} className="text-slate-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {/* Materia */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] text-slate-500 mb-1">Materia *</label>
                        <select
                          value={asig.materia_id}
                          onChange={(e) => updateAsig(idx, "materia_id", e.target.value)}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <option value="">Seleccionar…</option>
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                      </div>
                      {/* Grado */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Grado / Año *</label>
                        <select
                          value={asig.grado}
                          onChange={(e) => updateAsig(idx, "grado", e.target.value)}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <option value="">Seleccionar…</option>
                          {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      {/* Sección */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Sección *</label>
                        <select
                          value={asig.seccion}
                          onChange={(e) => updateAsig(idx, "seccion", e.target.value)}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <option value="">—</option>
                          {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {/* Día */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Día</label>
                        <select
                          value={asig.dia_semana}
                          onChange={(e) => updateAsig(idx, "dia_semana", e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                          <option value="">Todos</option>
                          {DIAS.map((d) => <option key={d.num} value={d.num}>{d.label}</option>)}
                        </select>
                      </div>
                      {/* Hora inicio */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Hora inicio</label>
                        <input
                          type="time"
                          value={asig.hora_inicio}
                          onChange={(e) => updateAsig(idx, "hora_inicio", e.target.value)}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                      {/* Hora fin */}
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Hora fin</label>
                        <input
                          type="time"
                          value={asig.hora_fin}
                          onChange={(e) => updateAsig(idx, "hora_fin", e.target.value)}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addAsig}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400 text-sm hover:bg-indigo-500/10 transition-all"
              >
                <Plus className="w-4 h-4" /> Añadir otra clase
              </button>

              {materias.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  No hay materias registradas aún. Ve a <strong>Académico → Materias</strong> primero.
                </div>
              )}
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-all text-sm disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Save className="w-4 h-4" /> Guardar Configuración</>}
          </button>
        </div>
      </div>
    </div>
  );
}
