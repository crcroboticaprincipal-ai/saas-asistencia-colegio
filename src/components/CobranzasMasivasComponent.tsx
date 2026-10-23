"use client";

import { useState, useRef, useId } from "react";
import * as XLSX from "xlsx";
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  AlertCircle, Play, Download, Trash2, Mail, 
  DollarSign, ArrowLeft, ShieldCheck, Check, Loader2, Sparkles, XCircle 
} from "lucide-react";
import Link from "next/link";

interface FilaProcesada {
  idx: number;
  estado: "listo" | "sin_correo" | "no_encontrado";
  estudiante_id: string | null;
  cedula: string | null;
  nombre_estudiante: string;
  nombre_archivo: string;
  grado: string;
  seccion: string;
  seccion_archivo: string;
  nombre_representante: string;
  correo_representante: string;
  deuda_dolares: number;
  mora_dolares: number;
  total_dolares: number;
  mes_vencido: string;
  foto_url?: string | null;
  resultadoEnvio?: {
    ok: boolean;
    error?: string;
    emailId?: string;
  };
}

interface ResumenMatch {
  totalFilas: number;
  totalListos: number;
  totalSinCorreo: number;
  totalNoEncontrados: number;
  montoGlobalTotal: number;
}

export function CobranzasMasivasComponent() {
  const [fileData, setFileData] = useState<{ name: string; size: number } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [filas, setFilas] = useState<FilaProcesada[]>([]);
  const [resumen, setResumen] = useState<ResumenMatch | null>(null);
  const [filtroTab, setFiltroTab] = useState<"todos" | "listos" | "advertencias">("todos");

  // Dispatch progress state
  const [despachando, setDespachando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, actualNombre: "" });
  const [despachoTerminado, setDespachoTerminado] = useState(false);
  const abortControllerRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneId = useId();

  // ── Leer archivo en memoria volátil (Cero Residuos) ──
  const procesarArchivoEnMemoria = async (file: File) => {
    try {
      setParsing(true);
      setDespachoTerminado(false);

      const buffer = await file.arrayBuffer();
      // Procesamiento puramente en memoria volátil:
      const workbook = XLSX.read(buffer, { type: "array" });
      const primeraHoja = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeraHoja, { defval: "" });

      if (rawRows.length === 0) {
        alert("El archivo no contiene filas o está vacío.");
        setParsing(false);
        return;
      }

      setFileData({ name: file.name, size: file.size });

      // Normalizar nombres de columnas
      const filasMapeadas = rawRows.map((r) => {
        const rowLower: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          const kNorm = k
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "_");
          rowLower[kNorm] = v;
        }

        const nombreEstudiante = String(
          rowLower.nombre_estudiante ||
          rowLower.estudiante ||
          rowLower.alumno ||
          rowLower.nombres_y_apellidos ||
          rowLower.nombre ||
          ""
        ).trim();

        const nombreRepresentante = String(
          rowLower.nombre_representante ||
          rowLower.representante ||
          rowLower.acudiente ||
          ""
        ).trim();

        const seccion = String(
          rowLower.seccion ||
          rowLower.grado_seccion ||
          rowLower.curso ||
          rowLower.grado ||
          ""
        ).trim();

        const deudaDolares =
          rowLower.deuda_dolares ||
          rowLower.deuda ||
          rowLower.monto_cuotas ||
          rowLower.monto ||
          rowLower.saldo ||
          rowLower.total ||
          0;

        const mesVencido = String(
          rowLower.mes_vencido ||
          rowLower.mes ||
          rowLower.concepto ||
          rowLower.cuota ||
          "Mensualidad Escolar"
        ).trim();

        const mora =
          rowLower.mora ||
          rowLower.recargo ||
          rowLower.intereses_mora ||
          0;

        return {
          nombre_estudiante: nombreEstudiante,
          nombre_representante: nombreRepresentante,
          seccion,
          deuda_dolares: deudaDolares,
          mes_vencido: mesVencido,
          mora,
        };
      }).filter((f) => f.nombre_estudiante.length > 0);

      if (filasMapeadas.length === 0) {
        alert("No se detectaron registros con nombres de estudiantes en el archivo.");
        setParsing(false);
        return;
      }

      // Cruce inteligente con la base de datos
      setMatching(true);
      const resMatch = await fetch("/api/admin/cobranzas/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: filasMapeadas }),
      });

      const matchData = await resMatch.json();
      if (!resMatch.ok) {
        throw new Error(matchData.error || "Error al realizar cruce de estudiantes.");
      }

      setResumen(matchData.resumen);
      setFilas(matchData.filas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error procesando el archivo.";
      alert(msg);
      resetearCarga();
    } finally {
      setParsing(false);
      setMatching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivoEnMemoria(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      procesarArchivoEnMemoria(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const resetearCarga = () => {
    setFileData(null);
    setFilas([]);
    setResumen(null);
    setDespachando(false);
    setDespachoTerminado(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Modificar manualmente correo en caso de advertencia
  const handleActualizarCorreo = (idx: number, nuevoCorreo: string) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.idx === idx) {
          const valido = nuevoCorreo.includes("@");
          return {
            ...f,
            correo_representante: nuevoCorreo,
            estado: valido ? "listo" : "sin_correo",
          };
        }
        return f;
      })
    );
  };

  // ── Despacho Controlado (Pausa de 300 ms entre envíos) ──
  const iniciarEnvioMasivo = async () => {
    const filasParaEnviar = filas.filter((f) => f.estado === "listo" && f.correo_representante);
    if (filasParaEnviar.length === 0) {
      alert("No hay destinatarios con correo validado para enviar.");
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas el envío masivo de notificaciones a ${filasParaEnviar.length} representantes por un monto total de $${filasParaEnviar
        .reduce((acc, curr) => acc + curr.total_dolares, 0)
        .toFixed(2)} USD?`
    );
    if (!confirmar) return;

    setDespachando(true);
    abortControllerRef.current = false;
    setProgreso({ actual: 0, total: filasParaEnviar.length, actualNombre: "" });

    for (let i = 0; i < filasParaEnviar.length; i++) {
      if (abortControllerRef.current) {
        break;
      }

      const item = filasParaEnviar[i];
      setProgreso({
        actual: i + 1,
        total: filasParaEnviar.length,
        actualNombre: item.nombre_estudiante,
      });

      try {
        const res = await fetch("/api/admin/cobranzas/enviar-individual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            correo: item.correo_representante,
            nombreEstudiante: item.nombre_estudiante,
            nombreRepresentante: item.nombre_representante,
            grado: item.grado,
            seccion: item.seccion,
            conceptoMeses: `Mes Vencido: ${item.mes_vencido}`,
            montoCuotas: item.deuda_dolares,
            montoMora: item.mora_dolares,
          }),
        });

        const data = await res.json();
        setFilas((prev) =>
          prev.map((f) =>
            f.idx === item.idx
              ? {
                  ...f,
                  resultadoEnvio: {
                    ok: res.ok,
                    error: res.ok ? undefined : data.error || "Fallo en envío",
                    emailId: data.emailId,
                  },
                }
              : f
          )
        );
      } catch (err: unknown) {
        setFilas((prev) =>
          prev.map((f) =>
            f.idx === item.idx
              ? {
                  ...f,
                  resultadoEnvio: {
                    ok: false,
                    error: err instanceof Error ? err.message : "Error de red",
                  },
                }
              : f
          )
        );
      }

      // Pausa controlada de 300 ms entre cada mensaje
      if (i < filasParaEnviar.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setDespachando(false);
    setDespachoTerminado(true);
  };

  const cancelarDespacho = () => {
    abortControllerRef.current = true;
    setDespachando(false);
  };

  // ── Descarga de Reporte en CSV ──
  const descargarReporteCSV = () => {
    const encabezados = [
      "Estudiante",
      "Sección",
      "Representante",
      "Correo",
      "Concepto",
      "Monto Cuotas ($)",
      "Mora ($)",
      "Total ($)",
      "Estatus",
      "Detalle",
    ];

    const filasCSV = filas.map((f) => {
      let estatus = "No enviado";
      let detalle = "";
      if (f.resultadoEnvio) {
        estatus = f.resultadoEnvio.ok ? "Enviado exitosamente" : "Error de envío";
        detalle = f.resultadoEnvio.error || `ID: ${f.resultadoEnvio.emailId || "OK"}`;
      } else if (f.estado === "sin_correo") {
        estatus = "Omitido";
        detalle = "Sin correo registrado";
      } else if (f.estado === "no_encontrado") {
        estatus = "Omitido";
        detalle = "No localizado en base de datos";
      }

      return [
        `"${f.nombre_estudiante.replace(/"/g, '""')}"`,
        `"${(f.seccion || f.seccion_archivo).replace(/"/g, '""')}"`,
        `"${f.nombre_representante.replace(/"/g, '""')}"`,
        `"${f.correo_representante.replace(/"/g, '""')}"`,
        `"${f.mes_vencido.replace(/"/g, '""')}"`,
        f.deuda_dolares.toFixed(2),
        f.mora_dolares.toFixed(2),
        f.total_dolares.toFixed(2),
        `"${estatus}"`,
        `"${detalle.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [encabezados.join(","), ...filasCSV].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Reporte_Cobranza_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filasFiltradas = filas.filter((f) => {
    if (filtroTab === "listos") return f.estado === "listo";
    if (filtroTab === "advertencias") return f.estado !== "listo";
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Barra de Título y Navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-amber-400 font-semibold">Cobranzas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-amber-400" />
            Módulo de Cobranza Institucional
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Notificaciones de saldos pendientes mediante carga temporal en memoria (Cero Residuos)
          </p>
        </div>

        {filas.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={resetearCarga}
              disabled={despachando}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-white/5 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Descartar Archivo
            </button>
            {despachoTerminado && (
              <button
                onClick={descargarReporteCSV}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Exportar Resultado CSV
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── ZONA 1: CARGA DE ARCHIVO EN MEMORIA VOLÁTIL ── */}
      {filas.length === 0 ? (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="glass-panel border-2 border-dashed border-white/15 hover:border-amber-400/50 rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer bg-slate-900/40 hover:bg-slate-900/60 shadow-xl group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              id={dropZoneId}
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {parsing || matching ? (
                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
              {parsing ? "Leyendo archivo en memoria volátil..." : matching ? "Cruzando con base de datos..." : "Arrastra tu archivo Excel o CSV de Cobranza aquí"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Estructura sugerida: <code className="text-amber-300 font-mono">nombre_estudiante, nombre_representante, seccion, deuda_dolares, mes_vencido</code>
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 group-hover:text-white">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Seleccionar archivo (.xlsx / .csv)
            </div>
          </div>

          {/* Banner de Garantía Cero Residuos y Seguridad Financiera */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Procesamiento en Memoria (Cero Residuos)
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  El archivo no se almacena en el disco del servidor ni en la nube. Se procesa en memoria volátil y se destruye inmediatamente tras el envío.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/20 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Cruce Inteligente (Smart Match)
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  El sistema detecta automáticamente al estudiante y extrae su correo institucional registrado para evitar errores de digitación en los montos.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── ZONA 2: TABLA PREVIA DE CRUCE Y DESPACHO ── */
        <div className="space-y-6">

          {/* Tarjetas Bento de Resumen Previo */}
          {resumen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="glass-card p-4 rounded-2xl border border-white/10">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Registros
                </span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {resumen.totalFilas}
                </span>
                <span className="text-[11px] text-slate-500">Filas en archivo</span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  Listos para Envío
                </span>
                <span className="text-2xl font-black text-emerald-300 mt-1 block">
                  {resumen.totalListos}
                </span>
                <span className="text-[11px] text-emerald-500/80">Con correo verificado</span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-rose-500/25 bg-rose-500/5">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                  Advertencias
                </span>
                <span className="text-2xl font-black text-rose-300 mt-1 block">
                  {resumen.totalSinCorreo + resumen.totalNoEncontrados}
                </span>
                <span className="text-[11px] text-rose-500/80">
                  {resumen.totalSinCorreo} sin email · {resumen.totalNoEncontrados} no hallados
                </span>
              </div>

              <div className="glass-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
                  Monto Global
                </span>
                <span className="text-2xl font-black text-white font-mono mt-1 block">
                  ${resumen.montoGlobalTotal.toFixed(2)}
                </span>
                <span className="text-[11px] text-amber-400 font-bold">USD a notificar</span>
              </div>
            </div>
          )}

          {/* Barra interactiva de despacho en vivo */}
          {despachando && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-3 animate-slide-up">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="font-bold text-white">
                    Enviando notificación {progreso.actual} de {progreso.total}…
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    ({progreso.actualNombre})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-amber-300 font-bold">
                    {Math.round((progreso.actual / (progreso.total || 1)) * 100)}%
                  </span>
                  <button
                    onClick={cancelarDespacho}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30"
                  >
                    Detener
                  </button>
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round((progreso.actual / (progreso.total || 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 italic">
                * Pausa de 300 ms entre cada mensaje para respetar los límites del proveedor de correo.
              </p>
            </div>
          )}

          {/* Panel de Control y Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-white/5 text-xs">
              <button
                onClick={() => setFiltroTab("todos")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filtroTab === "todos"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos ({filas.length})
              </button>
              <button
                onClick={() => setFiltroTab("listos")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filtroTab === "listos"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Listos ({resumen?.totalListos || 0})
              </button>
              <button
                onClick={() => setFiltroTab("advertencias")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filtroTab === "advertencias"
                    ? "bg-rose-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Advertencias ({((resumen?.totalSinCorreo || 0) + (resumen?.totalNoEncontrados || 0))})
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={iniciarEnvioMasivo}
                disabled={despachando || (resumen?.totalListos || 0) === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {despachando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Despachando...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>🚀 Iniciar Envío Masivo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tabla de Resultados del Cruce */}
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/80 sticky top-0 z-10 border-b border-white/10">
                  <tr className="text-slate-400 uppercase font-semibold">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Estudiante (Archivo vs BD)</th>
                    <th className="py-3 px-4">Sección</th>
                    <th className="py-3 px-4">Representante y Correo</th>
                    <th className="py-3 px-4">Concepto / Mes</th>
                    <th className="py-3 px-4 text-right">Monto USD</th>
                    <th className="py-3 px-4 text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filasFiltradas.map((fila) => {
                    const esListo = fila.estado === "listo";
                    const esSinCorreo = fila.estado === "sin_correo";
                    const esNoEncontrado = fila.estado === "no_encontrado";
                    const resultado = fila.resultadoEnvio;

                    return (
                      <tr
                        key={fila.idx}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          resultado?.ok
                            ? "bg-emerald-500/5"
                            : resultado?.error
                            ? "bg-rose-500/5"
                            : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {fila.idx + 1}
                        </td>

                        {/* Nombre del Estudiante */}
                        <td className="py-3 px-4 font-medium">
                          <p className="text-white font-bold uppercase">
                            {fila.nombre_estudiante}
                          </p>
                          {fila.cedula && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              CI: {fila.cedula}
                            </p>
                          )}
                          {esNoEncontrado && (
                            <span className="text-[10px] text-rose-400">
                              No encontrado en el plantel
                            </span>
                          )}
                        </td>

                        {/* Sección */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-white/5 font-semibold text-slate-300">
                            {fila.seccion || fila.seccion_archivo || "-"}
                          </span>
                        </td>

                        {/* Representante & Correo */}
                        <td className="py-3 px-4">
                          <p className="text-slate-300 font-medium">
                            {fila.nombre_representante}
                          </p>
                          {esSinCorreo || esNoEncontrado ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <input
                                type="email"
                                placeholder="Escribir correo para notificar..."
                                value={fila.correo_representante}
                                onChange={(e) => handleActualizarCorreo(fila.idx, e.target.value)}
                                className="bg-slate-950 border border-rose-500/40 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-400 w-48"
                              />
                            </div>
                          ) : (
                            <p className="text-slate-400 font-mono text-[11px]">
                              {fila.correo_representante}
                            </p>
                          )}
                        </td>

                        {/* Concepto / Mes */}
                        <td className="py-3 px-4">
                          <span className="text-slate-300 font-medium">
                            {fila.mes_vencido}
                          </span>
                        </td>

                        {/* Montos */}
                        <td className="py-3 px-4 text-right font-mono">
                          <p className="font-bold text-white">
                            ${fila.total_dolares.toFixed(2)}
                          </p>
                          {fila.mora_dolares > 0 && (
                            <p className="text-[10px] text-rose-400">
                              (+$ {fila.mora_dolares.toFixed(2)} mora)
                            </p>
                          )}
                        </td>

                        {/* Estatus */}
                        <td className="py-3 px-4 text-center">
                          {resultado ? (
                            resultado.ok ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <Check className="w-3 h-3" /> Enviado
                              </span>
                            ) : (
                              <span
                                title={resultado.error}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 cursor-help"
                              >
                                <XCircle className="w-3 h-3" /> Error
                              </span>
                            )
                          ) : esListo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Listo
                            </span>
                          ) : esSinCorreo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3" /> Sin correo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <AlertCircle className="w-3 h-3" /> No hallado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
