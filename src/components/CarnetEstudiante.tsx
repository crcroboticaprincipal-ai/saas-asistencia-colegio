"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

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

interface CarnetEstudianteProps {
  estudiante: Estudiante;
  showCropMarks?: boolean;
}

export function CarnetEstudiante({ estudiante, showCropMarks = false }: CarnetEstudianteProps) {
  const initials = estudiante.nombre_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`carnet-wrapper ${showCropMarks ? "carnet-with-crops" : ""}`}
      style={{ display: "inline-block", verticalAlign: "top" }}
    >
      {showCropMarks && (
        <>
          {/* Crop marks corners */}
          <span className="crop-tl" />
          <span className="crop-tr" />
          <span className="crop-bl" />
          <span className="crop-br" />
        </>
      )}
      <div
        className="carnet-card"
        style={{
          width: "204px",       /* 54mm ≈ 204px @96dpi */
          height: "323px",      /* 85.6mm ≈ 323px @96dpi */
          borderRadius: "10px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Calibri', 'Segoe UI', system-ui, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
          background: "#fff",
          position: "relative",
          pageBreakInside: "avoid",
          breakInside: "avoid",
        }}
      >
        {/* ── HEADER INSTITUCIONAL ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #1a3a6b 50%, #0d2347 100%)",
            padding: "8px 10px 6px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
            minHeight: "52px",
            borderBottom: "2px solid #c9a227",
          }}
        >
          <div style={{ flexShrink: 0, width: "36px", height: "36px", position: "relative" }}>
            <Image
              src="/logo crc.png"
              alt="Logo CRC"
              fill
              style={{ objectFit: "contain" }}
              unoptimized
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: "#c9a227",
                fontSize: "7px",
                fontWeight: "700",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                marginBottom: "1px",
              }}
            >
              U.E. Colegio
            </p>
            <p
              style={{
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: "800",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.15,
              }}
            >
              Rafael Castillo
            </p>
          </div>
          <div
            style={{
              background: "rgba(201,162,39,0.15)",
              border: "1px solid rgba(201,162,39,0.4)",
              borderRadius: "4px",
              padding: "3px 5px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <p style={{ color: "#c9a227", fontSize: "6px", fontWeight: "700", lineHeight: 1.2 }}>AÑO ESCOLAR</p>
            <p style={{ color: "#fff", fontSize: "7px", fontWeight: "800", lineHeight: 1.2 }}>2026–2027</p>
          </div>
        </div>

        {/* ── FRANJA DECORATIVA DORADA ── */}
        <div
          style={{
            height: "3px",
            background: "linear-gradient(90deg, #c9a227, #f0d060, #c9a227)",
            flexShrink: 0,
          }}
        />

        {/* ── ETIQUETA ALUMNO ── */}
        <div
          style={{
            background: "#1a3a6b",
            padding: "3px 10px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <p style={{ color: "#e0eaff", fontSize: "7.5px", fontWeight: "700", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Credencial de Estudiante
          </p>
        </div>

        {/* ── FOTO ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "10px",
            paddingBottom: "8px",
            flexShrink: 0,
            background: "#f8faff",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "86px",
              borderRadius: "6px",
              overflow: "hidden",
              border: "2.5px solid #1a3a6b",
              boxShadow: "0 2px 10px rgba(26,58,107,0.25)",
              background: "linear-gradient(135deg, #e8edf8, #dde3f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
            }}
          >
            {estudiante.foto_url ? (
              <Image
                src={estudiante.foto_url}
                alt={estudiante.nombre_completo}
                fill
                style={{ objectFit: "cover" }}
                unoptimized
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1a3a6b, #0d2347)",
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontSize: "22px",
                    fontWeight: "800",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {initials}
                </span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "7px", marginTop: "4px" }}>Sin foto</span>
              </div>
            )}
          </div>
        </div>

        {/* ── DATOS DEL ESTUDIANTE ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 10px 6px",
            background: "#f8faff",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#0a1628",
              fontSize: "10px",
              fontWeight: "800",
              lineHeight: 1.25,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              marginBottom: "4px",
            }}
          >
            {estudiante.nombre_completo}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: "4px",
                padding: "2px 6px",
              }}
            >
              <span style={{ color: "#4338ca", fontSize: "7.5px", fontWeight: "700" }}>CI: {estudiante.cedula}</span>
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "linear-gradient(135deg, #1a3a6b, #0d2347)",
              borderRadius: "6px",
              padding: "4px 10px",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: "800",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {estudiante.grado} &ldquo;{estudiante.seccion}&rdquo;
            </span>
          </div>
        </div>

        {/* ── PIE DEL CARNET ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #0a1628 0%, #1a3a6b 100%)",
            borderTop: "2px solid #c9a227",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {/* QR Code */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "5px",
              padding: "3px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              flexShrink: 0,
            }}
          >
            <QRCodeSVG
              value={estudiante.qr_code || estudiante.id}
              size={56}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Info derecha */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <p style={{ color: "#c9a227", fontSize: "6.5px", fontWeight: "700", letterSpacing: "0.08em", marginBottom: "2px" }}>
              CREDENCIAL SEGURA
            </p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "7px", fontWeight: "600", lineHeight: 1.3 }}>
              ASISTO
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "6px", lineHeight: 1.3 }}>
              Sistema de Asistencia
            </p>
            <div
              style={{
                marginTop: "4px",
                background: "rgba(201,162,39,0.2)",
                border: "1px solid rgba(201,162,39,0.35)",
                borderRadius: "3px",
                padding: "1px 4px",
                display: "inline-block",
              }}
            >
              <p style={{ color: "#c9a227", fontSize: "6px", fontWeight: "700" }}>2026 – 2027</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
