"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Estudiante = {
  id: string;
  qr_code: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  foto_url?: string | null;
  institucion_id?: string;
};

function CarnetPreviewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [student, setStudent] = useState<Estudiante | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("estudiantes")
      .select("id, qr_code, cedula, nombre_completo, grado, seccion, foto_url, institucion_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setStudent(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Estudiante no encontrado.
      </div>
    );
  }

  const initials = student.nombre_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Control bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/10 print:hidden">
        <Link
          href={`/admin/estudiantes/${student.id}`}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a la Ficha
        </Link>
        <h1 className="text-white font-bold">Carnet Digital — {student.nombre_completo}</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
        </button>
      </div>

      {/* Preview area */}
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] p-8 print:p-0 print:min-h-screen print:items-start print:justify-start">
        {/* Carnet */}
        <div
          style={{
            width: "54mm",
            height: "85.6mm",
            borderRadius: "8px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Arial', sans-serif",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            background: "#fff",
          }}
        >
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a3a6b 100%)", padding: "6px 8px 4px", display: "flex", alignItems: "center", gap: "6px", borderBottom: "2px solid #c9a227", minHeight: "48px" }}>
            <div style={{ width: "32px", height: "32px", flexShrink: 0, overflow: "hidden", borderRadius: "3px", background: "rgba(255,255,255,0.1)" }}>
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
          <div style={{ height: "2px", background: "linear-gradient(90deg, #c9a227, #f0d060, #c9a227)", flexShrink: 0 }} />
          <div style={{ background: "#1a3a6b", padding: "2px 8px", textAlign: "center", flexShrink: 0 }}>
            <p style={{ color: "#e0eaff", fontSize: "6pt", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>Credencial de Estudiante</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "8px", paddingBottom: "6px", background: "#f8faff", flexShrink: 0 }}>
            <div style={{ width: "62px", height: "74px", borderRadius: "5px", overflow: "hidden", border: "2px solid #1a3a6b", background: "linear-gradient(135deg, #e8edf8, #dde3f0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {student.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a3a6b, #0d2347)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: "18pt", fontWeight: "800", lineHeight: 1 }}>{initials}</span>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "5pt", marginTop: "2px" }}>Sin foto</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px 4px", background: "#f8faff", textAlign: "center" }}>
            <p style={{ color: "#0a1628", fontSize: "8pt", fontWeight: "800", lineHeight: 1.2, textTransform: "uppercase", margin: "0 0 3px" }}>{student.nombre_completo}</p>
            <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "3px", padding: "1px 5px", marginBottom: "4px" }}>
              <span style={{ color: "#4338ca", fontSize: "6pt", fontWeight: "700" }}>CI: {student.cedula}</span>
            </div>
            <div style={{ background: "linear-gradient(135deg, #1a3a6b, #0d2347)", borderRadius: "5px", padding: "3px 8px" }}>
              <span style={{ color: "#fff", fontSize: "7.5pt", fontWeight: "800", textTransform: "uppercase" }}>{student.grado} &ldquo;{student.seccion}&rdquo;</span>
            </div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #0a1628, #1a3a6b)", borderTop: "2px solid #c9a227", padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: "4px", padding: "2px", flexShrink: 0 }}>
              <QRCodeSVG value={student.qr_code || student.id} size={48} level="H" includeMargin={false} />
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
      </div>
    </div>
  );
}

export default function CarnetPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>}>
      <CarnetPreviewContent />
    </Suspense>
  );
}
