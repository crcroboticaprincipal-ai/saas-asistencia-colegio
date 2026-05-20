"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, Plus, Trash2, Loader2, CheckCircle,
  AlertCircle, Search, GraduationCap, X
} from "lucide-react";

interface Materia {
  id: string;
  nombre: string;
  codigo: string | null;
  nivel: string | null;
  created_at: string;
}

const NIVELES = [
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
  "7mo (1er Año)", "8vo (2do Año)", "9no (3er Año)", "10mo (4to Año)", "11mo (5to Año)",
  "General",
];

// Reads institucion_id from the first record available, or uses a hardcoded fallback
const FALLBACK_INST_ID = process.env.NEXT_PUBLIC_INSTITUCION_ID ?? "";

export default function MateriasComponent() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [institId, setInstitId] = useState(FALLBACK_INST_ID);

  const [form, setForm] = useState({ nombre: "", codigo: "", nivel: "General" });

  useEffect(() => {
    fetchMaterias();
    // Resolve institucion_id dynamically from instituciones if not set
    if (!institId) {
      fetch("/api/admin/instituciones")
        .then((r) => r.json())
        .then(({ data }) => { if (data?.[0]?.id) setInstitId(data[0].id); })
        .catch(() => {});
    }
  }, []);

  const fetchMaterias = () => {
    setLoading(true);
    fetch("/api/admin/materias")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setMaterias(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/materias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, institucion_id: institId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Materia "${form.nombre}" creada.`);
      setForm({ nombre: "", codigo: "", nivel: "General" });
      setShowForm(false);
      fetchMaterias();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (materia: Materia) => {
    if (!confirm(`¿Eliminar "${materia.nombre}"? Esta acción es irreversible.`)) return;
    try {
      const res = await fetch("/api/admin/materias", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: materia.id }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      fetchMaterias();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const filtered = materias.filter((m) =>
    search === "" ||
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (m.codigo ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-violet-400" />
            Materias
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Gestión del catálogo académico de la institución</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-500/20 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Nueva Materia
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Search */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? "Sin resultados" : "No hay materias. Crea la primera con el botón de arriba."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Materia</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-4 uppercase tracking-wider hidden md:table-cell">Código</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-4 uppercase tracking-wider hidden lg:table-cell">Nivel / Grado</th>
                  <th className="px-4 py-4 w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-violet-400" />
                        </div>
                        <p className="text-white font-medium text-sm">{m.nombre}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                        {m.codigo || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">{m.nivel || "General"}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleEliminar(m)}
                        className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Eliminar materia"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear materia */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-400" /> Nueva Materia
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre de la Materia <span className="text-rose-400">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="ej: Física, Matemáticas, Historia…"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Código <span className="text-slate-600">(opcional)</span></label>
                <input
                  type="text"
                  placeholder="ej: FIS, MAT, HIS"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-sm font-mono"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nivel / Grado</label>
                <select
                  value={form.nivel}
                  onChange={(e) => setForm({ ...form, nivel: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-sm"
                >
                  {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.nombre.trim()}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold flex items-center gap-2 text-sm disabled:opacity-50 shadow-lg shadow-violet-500/20 transition-all"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Plus className="w-4 h-4" /> Crear Materia</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
