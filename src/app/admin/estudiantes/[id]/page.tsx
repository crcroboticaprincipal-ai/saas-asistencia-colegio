"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase/client";
import { 
  ArrowLeft, Calendar, FileText, Download, 
  Clock, LogIn, LogOut, AlertTriangle, 
  CheckCircle, Loader2, User, Building, Percent
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Estudiante = {
  id: string;
  institucion_id: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
  created_at: string;
  estado: string;
  foto_url?: string | null;
};

type Asistencia = {
  id: string;
  tipo: "ENTRADA" | "SALIDA";
  fecha: string;
  hora: string;
  metodo?: string;
  created_at: string;
};

type Institucion = {
  id: string;
  nombre: string;
  configuracion_academica: {
    hora_entrada: string;
    hora_salida: string;
    tolerancia_minutos: number;
  };
};

export default function EstudianteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [student, setStudent] = useState<Estudiante | null>(null);
  const [institucion, setInstitucion] = useState<Institucion | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch Student
        const { data: std, error: stdErr } = await supabase
          .from("estudiantes")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (stdErr || !std) {
          throw new Error("No se encontró al estudiante");
        }
        setStudent(std);

        // 2. Fetch Institution
        const { data: inst } = await supabase
          .from("instituciones")
          .select("*")
          .eq("id", std.institucion_id)
          .maybeSingle();
        setInstitucion(inst);

        // 3. Fetch Asistencias
        const { data: asis, error: asisErr } = await supabase
          .from("asistencias")
          .select("id, tipo, fecha, hora, metodo, created_at")
          .eq("estudiante_id", id)
          .order("fecha", { ascending: false })
          .order("hora", { ascending: false });

        if (asisErr) throw asisErr;
        setAsistencias(asis || []);
      } catch (err: any) {
        setError(err.message || "Error al cargar la información");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] flex-col gap-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Cargando expediente escolar...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-rose-500/25 bg-rose-500/5 max-w-md mx-auto text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Error</h3>
        <p className="text-slate-400 text-sm">{error || "Estudiante no encontrado"}</p>
        <Link href="/admin/estudiantes" className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold">
          Volver a Estudiantes
        </Link>
      </div>
    );
  }

  // Parse time thresholds for tardiness
  const horaEntradaStr = institucion?.configuracion_academica?.hora_entrada || "07:00";
  const tolerancia = institucion?.configuracion_academica?.tolerancia_minutos || 10;
  
  const parseTime = (timeStr: string) => {
    const [h, m, s] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const limiteEntrada = parseTime(horaEntradaStr) + tolerancia; // e.g. 7 * 60 + 10 = 430 minutos

  // Helper to check delay
  const isRetardo = (horaStr: string) => {
    return parseTime(horaStr) > limiteEntrada;
  };

  // Filtered asistencias list
  const filteredAsistencias = asistencias.filter((a) => {
    if (desde && a.fecha < desde) return false;
    if (hasta && a.fecha > hasta) return false;
    return true;
  });

  // Calculate statistics
  const totalEntradas = filteredAsistencias.filter((a) => a.tipo === "ENTRADA").length;
  const totalSalidas = filteredAsistencias.filter((a) => a.tipo === "SALIDA").length;
  const totalRetardos = filteredAsistencias.filter((a) => a.tipo === "ENTRADA" && isRetardo(a.hora)).length;

  // Calculate attendance rate (percentage of unique school days with an ENTRADA)
  // Assuming a standard academic period or based on school days in range
  const uniqueDays = Array.from(new Set(filteredAsistencias.map((a) => a.fecha)));
  const daysWithEntrance = Array.from(
    new Set(filteredAsistencias.filter((a) => a.tipo === "ENTRADA").map((a) => a.fecha))
  ).length;
  const totalExpectedDays = uniqueDays.length || 1;
  const asistenciaRate = Math.round((daysWithEntrance / totalExpectedDays) * 100) || 100;

  // Export PDF Report
  const downloadReportPDF = () => {
    const doc = new jsPDF();

    // Membrete
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, 210, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(institucion?.nombre || "Colegio Rafael Castillo", 15, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("SISTEMA INTELIGENTE DE ASISTENCIA — ASISTO PRO", 15, 22);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 15, 27);

    // Datos del Alumno
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("EXPEDIENTE Y REPORTE DE AUDITORÍA DE ASISTENCIA", 15, 48);

    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(15, 52, 195, 52);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Estudiante: ${student.nombre_completo}`, 15, 60);
    doc.text(`Cédula / ID: ${student.cedula}`, 15, 66);
    doc.text(`Grado y Sección: ${student.grado} - ${student.seccion}`, 15, 72);
    doc.text(`Estado Escolar: ${student.estado || "Activo"}`, 15, 78);

    doc.text(`Representante: ${student.nombre_representante || "No registrado"}`, 120, 60);
    doc.text(`Correo Repr.: ${student.correo_representante || "No registrado"}`, 120, 66);
    doc.text(`Periodo del Reporte: ${desde || "Inicio"} al ${hasta || "Hoy"}`, 120, 72);
    doc.text(`Tasa de Asistencia: ${asistenciaRate}%`, 120, 78);

    // Tabla de Asistencia
    const headers = [["Fecha", "Hora", "Movimiento", "Estado", "Método"]];
    const dataRows = filteredAsistencias.map((a) => {
      const ret = a.tipo === "ENTRADA" && isRetardo(a.hora);
      let estadoText = "Puntual";
      if (a.tipo === "ENTRADA" && ret) estadoText = "Retardo";
      if (a.tipo === "SALIDA") estadoText = "Egreso";
      return [
        a.fecha,
        a.hora,
        a.tipo,
        estadoText,
        a.metodo || "QR"
      ];
    });

    autoTable(doc, {
      startY: 86,
      head: headers,
      body: dataRows,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      styles: { fontSize: 9, cellPadding: 3 },
    });

    // Save PDF
    doc.save(`Asistencia_${student.cedula}_Reporte.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in py-4">
      {/* Back link */}
      <div>
        <Link 
          href="/admin/estudiantes" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Volver a Estudiantes
        </Link>
      </div>

      {/* Bento Layout: Profile Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/[0.06] flex flex-col items-center text-center gap-4">
          <div className="relative">
            {student.foto_url ? (
              <Image 
                src={student.foto_url} 
                alt={student.nombre_completo}
                width={120} 
                height={120} 
                className="w-28 h-28 rounded-full object-cover border-2 border-indigo-500/30"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                <User className="w-12 h-12 text-slate-500" />
              </div>
            )}
            <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-slate-900 ${
              student.estado === "Activo" ? "bg-emerald-500" : "bg-rose-500"
            }`} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white leading-snug">{student.nombre_completo}</h2>
            <p className="text-slate-500 text-sm font-mono mt-0.5">C.I. {student.cedula}</p>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-white/[0.06] text-left">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Grado</p>
              <p className="text-white text-sm font-semibold">{student.grado}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Sección</p>
              <p className="text-white text-sm font-semibold">&ldquo;{student.seccion}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Bento Stats */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          
          <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Entradas</span>
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                <LogIn className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold text-white mt-4">{totalEntradas}</h3>
              <p className="text-slate-500 text-[10px] sm:text-xs mt-1">Registros en el periodo</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Salidas</span>
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                <LogOut className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold text-white mt-4">{totalSalidas}</h3>
              <p className="text-slate-500 text-[10px] sm:text-xs mt-1">Registros en el periodo</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Retardos</span>
              <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-4">{totalRetardos}</h3>
              <p className="text-slate-500 text-[10px] sm:text-xs mt-1">Llegadas después de hora</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tasa Asistencia</span>
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold text-indigo-400 mt-4">{asistenciaRate}%</h3>
              <p className="text-slate-500 text-[10px] sm:text-xs mt-1">Efectividad escolar</p>
            </div>
          </div>

        </div>

      </div>

      {/* History Bento Section */}
      <div className="glass-panel p-6 rounded-2xl border border-white/[0.06] space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Historial de Accesos Completo</h2>
          </div>
          
          <button 
            onClick={downloadReportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/10 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            📥 Descargar Historial
          </button>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Desde</label>
            <input 
              type="date" 
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full bg-slate-950/40 border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hasta</label>
            <input 
              type="date" 
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full bg-slate-950/40 border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {(desde || hasta) && (
            <button 
              onClick={() => { setDesde(""); setHasta(""); }}
              className="text-slate-500 hover:text-white text-xs self-end pb-2.5 text-left font-medium transition-colors"
            >
              Restablecer filtros
            </button>
          )}
        </div>

        {/* Timeline Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">Movimiento</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Método</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredAsistencias.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No se encontraron registros de asistencia para este periodo.
                  </td>
                </tr>
              ) : (
                filteredAsistencias.map((a) => {
                  const ret = a.tipo === "ENTRADA" && isRetardo(a.hora);
                  return (
                    <tr key={a.id} className="hover:bg-white/[0.01] transition-colors text-slate-300">
                      <td className="py-3.5 px-4 font-medium">{a.fecha}</td>
                      <td className="py-3.5 px-4 font-mono">{a.hora}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border text-[10px] ${
                          a.tipo === "ENTRADA" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {a.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {a.tipo === "ENTRADA" ? (
                          ret ? (
                            <span className="text-amber-400 font-semibold">⚠️ Retardo</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">✓ Puntual</span>
                          )
                        ) : (
                          <span className="text-slate-400">Egreso</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/[0.06] font-mono text-[10px] text-slate-400 uppercase">
                          {a.metodo || "QR"}
                        </span>
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
