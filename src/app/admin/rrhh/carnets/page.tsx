"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft, Users, Filter } from "lucide-react";
import Link from "next/link";
import type { Personal, Rol } from "@/lib/supabase/types";

const ROL_LABELS: Record<string, string> = {
  director: "Director / Directiva",
  coordinador: "Coordinador / Coordinadora",
  docente: "Docente",
  porteria: "Portería / Vigilancia",
  administrativo: "Administrativo / Administrativa",
  obrero: "Personal de Servicios",
  superadmin: "Super Administrador",
  staff_qrono: "Staff del Sistema",
};

const ROL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  director:      { bg: "#4c1d95", text: "#e9d5ff", border: "#7c3aed" },
  coordinador:   { bg: "#1e3a5f", text: "#bae6fd", border: "#3b82f6" },
  docente:       { bg: "#1e3a5f", text: "#c7d2fe", border: "#6366f1" },
  porteria:      { bg: "#064e3b", text: "#a7f3d0", border: "#10b981" },
  administrativo:{ bg: "#78350f", text: "#fde68a", border: "#f59e0b" },
  obrero:        { bg: "#1e293b", text: "#cbd5e1", border: "#64748b" },
  superadmin:    { bg: "#7f1d1d", text: "#fca5a5", border: "#ef4444" },
  staff_qrono:   { bg: "#1e293b", text: "#94a3b8", border: "#475569" },
};

function getInitials(nombres: string, apellidos: string) {
  return ((nombres.trim()[0] ?? "") + (apellidos.trim()[0] ?? "")).toUpperCase();
}

function CarnetPersonalCard({ personal }: { personal: Personal }) {
  const initials = getInitials(personal.nombres, personal.apellidos);
  const rolColor = ROL_COLORS[personal.rol] ?? ROL_COLORS.administrativo;
  const rolLabel = ROL_LABELS[personal.rol] ?? personal.rol;

  return (
    <div
      style={{
        width: "54mm",
        height: "85.6mm",
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Arial', sans-serif",
        background: "#fff",
        border: "1px solid #d1d5db",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a6b 100%)", padding: "6px 8px 4px", display: "flex", alignItems: "center", gap: "6px", borderBottom: "2px solid #c9a227", minHeight: "48px" }}>
        <div style={{ width: "32px", height: "32px", flexShrink: 0, overflow: "hidden", borderRadius: "3px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo crc.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#c9a227", fontSize: "6pt", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0, lineHeight: 1.2 }}>U.E. Colegio</p>
          <p style={{ color: "#fff", fontSize: "8pt", fontWeight: "800", textTransform: "uppercase", margin: 0, lineHeight: 1.2 }}>Rafael Castillo</p>
        </div>
        <div style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.4)", borderRadius: "3px", padding: "2px 4px", textAlign: "center" }}>
          <p style={{ color: "#c9a227", fontSize: "5pt", fontWeight: "700", margin: 0, lineHeight: 1.2 }}>AÑO ESCOLAR</p>
          <p style={{ color: "#fff", fontSize: "6pt", fontWeight: "800", margin: 0, lineHeight: 1.2 }}>2026–2027</p>
        </div>
      </div>

      {/* Franja dorada */}
      <div style={{ height: "2px", background: "linear-gradient(90deg, #c9a227, #f0d060, #c9a227)", flexShrink: 0 }} />

      {/* Label */}
      <div style={{ background: "#1a3a6b", padding: "2px 8px", textAlign: "center", flexShrink: 0 }}>
        <p style={{ color: "#e0eaff", fontSize: "6pt", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
          Personal Institucional
        </p>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px", paddingBottom: "6px", background: "#f0f4ff", flexShrink: 0 }}>
        <div style={{ width: "62px", height: "74px", borderRadius: "5px", overflow: "hidden", border: "2px solid #1a3a6b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0d2347, #1a3a6b)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#c9a227", fontSize: "20pt", fontWeight: "800", lineHeight: 1 }}>{initials}</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "5pt", marginTop: "3px" }}>Personal</span>
          </div>
        </div>
      </div>

      {/* Datos */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px 4px", background: "#f0f4ff", textAlign: "center" }}>
        <p style={{ color: "#0a1628", fontSize: "8pt", fontWeight: "800", lineHeight: 1.2, textTransform: "uppercase", margin: "0 0 3px" }}>
          {personal.apellidos}, {personal.nombres}
        </p>
        {personal.cedula && (
          <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "3px", padding: "1px 5px", marginBottom: "4px" }}>
            <span style={{ color: "#4338ca", fontSize: "6pt", fontWeight: "700" }}>CI: {personal.cedula}</span>
          </div>
        )}
        <div style={{ background: rolColor.bg, border: `1px solid ${rolColor.border}`, borderRadius: "5px", padding: "3px 8px", marginBottom: "2px" }}>
          <span style={{ color: rolColor.text, fontSize: "6.5pt", fontWeight: "800", textTransform: "uppercase" }}>{rolLabel}</span>
        </div>
        {personal.cargo && (
          <p style={{ color: "#475569", fontSize: "6pt", fontWeight: "600", margin: 0 }}>{personal.cargo}</p>
        )}
      </div>

      {/* Footer con QR */}
      <div style={{ background: "linear-gradient(135deg, #0a1628, #1a3a6b)", borderTop: "2px solid #c9a227", padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexShrink: 0 }}>
        <div style={{ background: "#fff", borderRadius: "4px", padding: "2px", flexShrink: 0 }}>
          <QRCodeSVG value={personal.id} size={48} level="H" includeMargin={false} />
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <p style={{ color: "#c9a227", fontSize: "5.5pt", fontWeight: "700", letterSpacing: "0.06em", margin: "0 0 1px" }}>CREDENCIAL SEGURA</p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "6pt", fontWeight: "700", margin: "0 0 1px" }}>ASISTO Platform</p>
          <div style={{ background: "rgba(201,162,39,0.2)", border: "1px solid rgba(201,162,39,0.35)", borderRadius: "2px", padding: "1px 3px", display: "inline-block", marginTop: "2px" }}>
            <p style={{ color: "#c9a227", fontSize: "5pt", fontWeight: "700", margin: 0 }}>2026 – 2027</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CarnetsMasivosPersonalPage() {
  const [loading, setLoading] = useState(true);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterRol, setFilterRol] = useState<string>("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    supabase
      .from("personal")
      .select("*")
      .eq("activo", true)
      .order("apellidos", { ascending: true })
      .then(({ data }) => {
        setPersonal((data as Personal[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = personal.filter((p) =>
    filterRol ? p.rol === filterRol : true
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const selectedPersonal = personal.filter((p) => selected.has(p.id));

  if (printing && selectedPersonal.length > 0) {
    return (
      <div
        className="bg-white min-h-screen absolute inset-0 z-50 overflow-auto print:relative print:overflow-visible"
        id="carnets-personal-print"
      >
        {/* Control bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 print:hidden">
          <h1 className="text-white font-bold">
            🏫 Carnets del Personal Institucional
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 font-semibold text-sm transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
            </button>
            <button
              onClick={() => setPrinting(false)}
              className="px-4 py-2.5 bg-slate-700 text-slate-200 rounded-xl hover:bg-slate-600 text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-medium print:hidden">
          ℹ️ Las líneas punteadas son guías de corte y desaparecen al imprimir. Se generan 9 carnets por hoja A4.
        </div>

        <div className="carnet-print-grid">
          {selectedPersonal.map((p) => (
            <div key={p.id} className="carnet-cell">
              <div className="crop-mark crop-tl" />
              <div className="crop-mark crop-tr" />
              <div className="crop-mark crop-bl" />
              <div className="crop-mark crop-br" />
              <CarnetPersonalCard personal={p} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/rrhh"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-400" />
                Carnets del Personal
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Selecciona el personal y genera los carnets institucionales CR-80
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setPrinting(true)}
          disabled={selected.size === 0}
          className={`px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all ${
            selected.size === 0
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
          }`}
        >
          <Printer className="w-4 h-4" />
          Imprimir ({selected.size})
        </button>
      </div>

      {/* Filtro por rol */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filtrar por cargo:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "director", "coordinador", "docente", "porteria", "administrativo", "obrero"].map((rol) => (
            <button
              key={rol}
              onClick={() => setFilterRol(rol)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                filterRol === rol
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-slate-800/60 text-slate-400 border-white/5 hover:border-white/15 hover:text-slate-200"
              }`}
            >
              {rol === "" ? "Todos" : ROL_LABELS[rol]}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-slate-500">
          {filtered.length} empleados · {selected.size} seleccionados
        </div>
      </div>

      {/* Tabla */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={selectAll}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
          />
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Seleccionar todos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Apellidos, Nombres</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Rol / Cargo</th>
                <th className="px-4 py-3 text-center">Carnet Individual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">
                    No se encontró personal activo
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const rolColor = ROL_COLORS[p.rol] ?? ROL_COLORS.administrativo;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {p.apellidos}, {p.nombres}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {p.cedula ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                          style={{
                            background: rolColor.bg,
                            color: rolColor.text,
                            borderColor: rolColor.border,
                          }}
                        >
                          {ROL_LABELS[p.rol] ?? p.rol}
                        </span>
                        {p.cargo && (
                          <p className="text-slate-500 text-[11px] mt-0.5">{p.cargo}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`/admin/rrhh/carnet-preview?id=${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-semibold transition-all"
                        >
                          <Printer className="w-3 h-3" />
                          Ver Carnet
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
