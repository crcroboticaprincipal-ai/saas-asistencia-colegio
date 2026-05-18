"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  UserCog, Plus, Search, ChevronRight, CheckCircle, XCircle,
  Clock, Calendar, Loader2, Save, X, Eye, EyeOff, Edit2
} from "lucide-react";
import type { Personal, Rol } from "@/lib/supabase/types";
import { generarEmailInterno } from "@/lib/login-pin";

const ROL_LABELS: Record<string, string> = {
  director: "Director/a",
  coordinador: "Coordinador/a",
  docente: "Docente",
  porteria: "Portería/Vigilancia",
  administrativo: "Administrativo/a",
  obrero: "Obrero/a",
};

const ROL_COLORS: Record<string, string> = {
  director: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  coordinador: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  docente: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  porteria: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  administrativo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  obrero: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

interface FormPersonal {
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  telefono: string;
  cargo: string;
  rol: Rol;
  username: string;
  pin: string;
}

const FORM_EMPTY: FormPersonal = {
  nombres: "", apellidos: "", cedula: "", correo: "",
  telefono: "", cargo: "", rol: "docente", username: "", pin: "",
};

export default function RRHHComponent() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormPersonal>(FORM_EMPTY);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const INSTITUCION_NOMBRE_CORTO = "CRC"; // Configurable futuro

  useEffect(() => {
    fetchPersonal();
  }, []);

  const fetchPersonal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("personal")
      .select("*")
      .order("apellidos", { ascending: true });
    if (data) setPersonal(data as Personal[]);
    setLoading(false);
  };

  const filtrado = useMemo(() => {
    return personal.filter((p) => {
      const matchSearch =
        search === "" ||
        `${p.nombres} ${p.apellidos} ${p.cedula} ${p.username}`.toLowerCase().includes(search.toLowerCase());
      const matchRol = filtroRol === "todos" || p.rol === filtroRol;
      return matchSearch && matchRol;
    });
  }, [personal, search, filtroRol]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editandoId) {
        // Actualizar empleado existente
        const { error: dbError } = await supabase.from("personal").update({
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          cedula: formData.cedula || null,
          correo: formData.correo || null,
          telefono: formData.telefono || null,
          cargo: formData.cargo || null,
          rol: formData.rol,
        }).eq("id", editandoId);

        if (dbError) throw new Error(dbError.message);
        setSuccess(`${formData.nombres} ${formData.apellidos} actualizado exitosamente.`);
      } else {
        // 1. Si tiene username y PIN, crear usuario en Supabase Auth vía API
        if (formData.username && formData.pin) {
          if (formData.pin.length < 4 || formData.pin.length > 6 || !/^\d+$/.test(formData.pin)) {
            throw new Error("El PIN debe tener entre 4 y 6 dígitos numéricos.");
          }

          const email = generarEmailInterno(formData.username, INSTITUCION_NOMBRE_CORTO);
          const res = await fetch("/api/admin/crear-usuario-personal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              pin: formData.pin,
              nombres: formData.nombres,
              apellidos: formData.apellidos,
              rol: formData.rol,
              username: formData.username,
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Error al crear usuario");
          }
        }

        // 2. Insertar en tabla personal
        const { error: dbError } = await supabase.from("personal").insert([{
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          cedula: formData.cedula || null,
          correo: formData.correo || null,
          telefono: formData.telefono || null,
          cargo: formData.cargo || null,
          rol: formData.rol,
          username: formData.username || null,
          institucion_id: "c4e8711a-f035-428c-b98f-69555a819ec7", // ID del Colegio Rafael Castillo
        }]);

        if (dbError) throw new Error(dbError.message);
        setSuccess(`${formData.nombres} ${formData.apellidos} registrado exitosamente.`);
      }

      setShowModal(false);
      setFormData(FORM_EMPTY);
      setEditandoId(null);
      fetchPersonal();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (p: Personal) => {
    setFormData({
      nombres: p.nombres,
      apellidos: p.apellidos,
      cedula: p.cedula || "",
      correo: p.correo || "",
      telefono: p.telefono || "",
      cargo: p.cargo || "",
      rol: p.rol,
      username: p.username || "",
      pin: "", // El PIN no se recupera por seguridad
    });
    setEditandoId(p.id);
    setError("");
    setShowModal(true);
  };

  const handleToggleActivo = async (p: Personal) => {
    await supabase.from("personal").update({ activo: !p.activo }).eq("id", p.id);
    fetchPersonal();
  };

  const kpis = useMemo(() => {
    const activos = personal.filter((p) => p.activo).length;
    const docentes = personal.filter((p) => p.rol === "docente").length;
    const conAcceso = personal.filter((p) => p.username).length;
    return { total: personal.length, activos, docentes, conAcceso };
  }, [personal]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <UserCog className="w-8 h-8 text-emerald-400" />
            Gestión de Personal
          </h1>
          <p className="text-slate-400 mt-1 text-sm">RRHH · Roles y Accesos del Colegio</p>
        </div>
        <button
          onClick={() => { setEditandoId(null); setShowModal(true); setFormData(FORM_EMPTY); setError(""); }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Nuevo Empleado
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Personal", value: kpis.total, color: "text-white", icon: "👥" },
          { label: "Activos", value: kpis.activos, color: "text-emerald-400", icon: "✅" },
          { label: "Docentes", value: kpis.docentes, color: "text-indigo-400", icon: "📚" },
          { label: "Con Acceso PIN", value: kpis.conAcceso, color: "text-blue-400", icon: "🔑" },
        ].map((k) => (
          <div key={k.label} className="glass-panel p-4 rounded-2xl">
            <p className="text-xl mb-1">{k.icon}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Filtros */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula o usuario..."
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="bg-slate-800/50 border border-white/10 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="todos">Todos los roles</option>
          {Object.entries(ROL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No se encontró personal</p>
            <p className="text-xs mt-1">Registra el primer empleado con el botón &quot;Nuevo Empleado&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-semibold text-slate-500 px-6 py-4 uppercase tracking-wider">Empleado</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-4 uppercase tracking-wider hidden md:table-cell">Rol</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-4 uppercase tracking-wider hidden lg:table-cell">Acceso</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-4 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {p.nombres[0]}{p.apellidos[0]}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{p.apellidos}, {p.nombres}</p>
                          <p className="text-slate-500 text-xs">{p.cargo || p.cedula || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROL_COLORS[p.rol]}`}>
                        {ROL_LABELS[p.rol]}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {p.username ? (
                        <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded-lg">@{p.username}</span>
                      ) : (
                        <span className="text-xs text-slate-600">Sin acceso PIN</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleActivo(p)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${p.activo
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20"}`}
                      >
                        {p.activo ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {p.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditar(p)}
                          className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                          title="Editar información"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nuevo Empleado */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-white/[0.08] shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editandoId ? "Editar Empleado" : "Registrar Empleado"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
            <form onSubmit={handleGuardar} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Nombres *", key: "nombres", required: true },
                  { label: "Apellidos *", key: "apellidos", required: true },
                  { label: "Cédula", key: "cedula", required: false },
                  { label: "Teléfono", key: "telefono", required: false },
                  { label: "Correo Personal", key: "correo", required: false },
                  { label: "Cargo (descripción)", key: "cargo", required: false },
                ].map(({ label, key, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                    <input
                      required={required}
                      type="text"
                      value={String(formData[key as keyof FormPersonal] || "")}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Rol *</label>
                <select
                  required
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as Rol })}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                >
                  {Object.entries(ROL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {!editandoId && (
                <div className="border-t border-white/5 pt-4">
                  <p className="text-xs text-slate-500 mb-3">
                    <span className="text-slate-300 font-medium">Acceso PIN</span> — Opcional. Permite al empleado iniciar sesión rápido con usuario y PIN de 4-6 dígitos.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nombre de Usuario</label>
                      <input
                        type="text"
                        placeholder="ej: profe_garcia"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono"
                      />
                      {formData.username && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          Email interno: {generarEmailInterno(formData.username, INSTITUCION_NOMBRE_CORTO)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">PIN (4-6 dígitos)</label>
                      <div className="relative">
                        <input
                          type={showPin ? "text" : "password"}
                          placeholder="••••••"
                          value={formData.pin}
                          maxLength={6}
                          onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
                          className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono"
                        />
                        <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Guardando..." : "Guardar Empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
