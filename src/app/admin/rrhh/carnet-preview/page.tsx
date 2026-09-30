"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft } from "lucide-react";
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
  const a = nombres.trim()[0] ?? "";
  const b = apellidos.trim()[0] ?? "";
  return (a + b).toUpperCase();
}

function CarnetPersonalView({ personal }: { personal: Personal }) {
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
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        background: "#fff",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #1a3a6b 100%)",
          padding: "6px 8px 4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          borderBottom: "2px solid #c9a227",
          minHeight: "48px",
        }}
      >
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

      {/* ── FRANJA DORADA ── */}
      <div style={{ height: "2px", background: "linear-gradient(90deg, #c9a227, #f0d060, #c9a227)", flexShrink: 0 }} />

      {/* ── LABEL PERSONAL ── */}
      <div style={{ background: "#1a3a6b", padding: "2px 8px", textAlign: "center", flexShrink: 0 }}>
        <p style={{ color: "#e0eaff", fontSize: "6pt", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
          Personal Institucional
        </p>
      </div>

      {/* ── FOTO / AVATAR ── */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px", paddingBottom: "6px", background: "#f0f4ff", flexShrink: 0 }}>
        <div style={{ width: "62px", height: "74px", borderRadius: "5px", overflow: "hidden", border: "2px solid #1a3a6b", background: "#e8edf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0d2347, #1a3a6b)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#c9a227", fontSize: "20pt", fontWeight: "800", lineHeight: 1 }}>{initials}</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "5pt", marginTop: "3px" }}>Personal</span>
          </div>
        </div>
      </div>

      {/* ── DATOS ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px 4px", background: "#f0f4ff", textAlign: "center" }}>
        <p style={{ color: "#0a1628", fontSize: "8pt", fontWeight: "800", lineHeight: 1.2, textTransform: "uppercase", margin: "0 0 3px" }}>
          {personal.apellidos}, {personal.nombres}
        </p>

        {personal.cedula && (
          <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "3px", padding: "1px 5px", marginBottom: "4px" }}>
            <span style={{ color: "#4338ca", fontSize: "6pt", fontWeight: "700" }}>CI: {personal.cedula}</span>
          </div>
        )}

        {/* ROL badge */}
        <div
          style={{
            background: rolColor.bg,
            border: `1px solid ${rolColor.border}`,
            borderRadius: "5px",
            padding: "3px 8px",
            marginBottom: "3px",
          }}
        >
          <span style={{ color: rolColor.text, fontSize: "6.5pt", fontWeight: "800", textTransform: "uppercase" }}>
            {rolLabel}
          </span>
        </div>

        {/* Cargo si existe */}
        {personal.cargo && (
          <p style={{ color: "#475569", fontSize: "6pt", fontWeight: "600", margin: 0 }}>
            {personal.cargo}
          </p>
        )}
      </div>

      {/* ── FOOTER CON QR ── */}
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

// ── Main page content ──
function CarnetPersonalContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("personal")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setPersonal(data as Personal | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!personal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Empleado no encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Control bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/10 print:hidden">
        <Link
          href="/admin/rrhh"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a RRHH
        </Link>
        <h1 className="text-white font-bold text-sm">
          Carnet — {personal.apellidos}, {personal.nombres}
        </h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
        </button>
      </div>

      {/* Preview */}
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] p-8 print:p-8 print:min-h-screen print:items-start print:justify-start">
        <CarnetPersonalView personal={personal} />
      </div>
    </div>
  );
}

export default function CarnetPersonalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <CarnetPersonalContent />
    </Suspense>
  );
}
