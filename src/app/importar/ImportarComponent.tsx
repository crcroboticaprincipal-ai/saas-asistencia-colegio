"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Upload, FileDown, CheckCircle, AlertCircle, Printer,
  QrCode, RefreshCw, Download, AlertTriangle, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { TODOS_LOS_GRADOS, SECCIONES } from "@/lib/grados-catalogo";

// ── Types ─────────────────────────────────────────────────────────────────────

type EstudianteRow = {
  Cedula: string;
  Nombres: string;
  Apellidos: string;
  Genero: string;
  GradoAno: string;
  Seccion: string;
  RepresentanteNombre: string;
  RepresentanteTelefono: string;
  RepresentanteCorreo: string;
};

type ImportedStudent = {
  id: string;
  qr_code: string;
  cedula: string;
  nombre: string;
  grado: string;
  seccion: string;
};

type ErrorValidacion = {
  fila: number;
  nombre: string;
  cedula: string;
  mensaje: string;
};

// ── Descarga de Plantilla Oficial con listas de validación ────────────────────

async function downloadTemplate() {
  const XLSX = await import("xlsx");

  // Hoja 1: Datos
  const filaEjemplo = [
    {
      cedula: "12345678",
      nombres: "JUAN CARLOS",
      apellidos: "PÉREZ GONZÁLEZ",
      genero: "M",
      grado_ano: "1er Año",
      seccion: "A",
      representante_nombre: "MARÍA GONZÁLEZ",
      representante_telefono: "0414-1234567",
      representante_correo: "maria@email.com",
    },
    {
      cedula: "87654321",
      nombres: "ANA MARÍA",
      apellidos: "RODRÍGUEZ LÓPEZ",
      genero: "F",
      grado_ano: "3er Grado",
      seccion: "B",
      representante_nombre: "CARLOS RODRÍGUEZ",
      representante_telefono: "0424-7654321",
      representante_correo: "carlos@email.com",
    },
  ];

  const wsData = XLSX.utils.json_to_sheet(filaEjemplo);
  wsData["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 8 },
    { wch: 14 }, { wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 30 },
  ];

  // Validaciones de datos (dropdown listas)
  const gradosValidos = TODOS_LOS_GRADOS.join(",");
  const seccionesValidas = SECCIONES.join(",");

  // Columna E (grado_ano) = fila 2 en adelante
  // Columna F (seccion) = fila 2 en adelante
  // Columna D (genero) = fila 2 en adelante
  wsData["!dataValidation"] = [
    {
      sqref: "E2:E501",
      type: "list",
      formula1: `"${gradosValidos}"`,
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: `Use uno de los valores del catálogo: ${gradosValidos}`,
    },
    {
      sqref: "F2:F501",
      type: "list",
      formula1: `"${seccionesValidas}"`,
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: "Sección inválida",
      error: "Use A o B",
    },
    {
      sqref: "D2:D501",
      type: "list",
      formula1: '"M,F"',
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: "Género inválido",
      error: "Use M (Masculino) o F (Femenino)",
    },
  ] as unknown[];

  // Hoja 2: Instrucciones
  const instrucciones = [
    ["INSTRUCCIONES DE USO — Plantilla Oficial Asisto"],
    [""],
    ["COLUMNA", "DESCRIPCIÓN", "OBLIGATORIO", "EJEMPLO"],
    ["cedula", "Número de cédula sin prefijo (solo dígitos)", "SÍ", "12345678"],
    ["nombres", "Nombres del estudiante (sin apellidos)", "SÍ", "JUAN CARLOS"],
    ["apellidos", "Apellidos del estudiante", "SÍ", "PÉREZ GONZÁLEZ"],
    ["genero", "M = Masculino, F = Femenino", "NO", "M"],
    ["grado_ano", "Selecciona del desplegable (ej: 1er Año, 3er Grado)", "SÍ", "1er Año"],
    ["seccion", "A o B", "SÍ", "A"],
    ["representante_nombre", "Nombre del padre/madre/tutor", "SÍ", "MARÍA GONZÁLEZ"],
    ["representante_telefono", "Teléfono de contacto del representante", "NO", "0414-1234567"],
    ["representante_correo", "Correo del representante para notificaciones", "SÍ", "maria@email.com"],
    [""],
    ["GRADOS Y AÑOS VÁLIDOS:"],
    ["Primaria:", "1er Grado, 2do Grado, 3er Grado, 4to Grado, 5to Grado, 6to Grado"],
    ["Bachillerato:", "1er Año, 2do Año, 3er Año, 4to Año, 5to Año"],
    [""],
    ["⚠️  NO modifiques los encabezados de la fila 1."],
    ["⚠️  Elimina las filas de ejemplo antes de importar tus datos."],
    ["⚠️  Máximo 500 estudiantes por archivo."],
  ];

  const wsInst = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInst["!cols"] = [{ wch: 25 }, { wch: 50 }, { wch: 14 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, "Estudiantes");
  XLSX.utils.book_append_sheet(wb, wsInst, "INSTRUCCIONES");
  XLSX.writeFile(wb, "plantilla_alumnos_asisto.xlsx");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportarComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<EstudianteRow[]>([]);
  const [erroresValidacion, setErroresValidacion] = useState<ErrorValidacion[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<{ type: "success" | "error" | "warn" | null; message: string }>({ type: null, message: "" });
  const [showPrintView, setShowPrintView] = useState(false);
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setStatus({ type: null, message: "" });
    setErroresValidacion([]);
    setData([]);

    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const normalized: EstudianteRow[] = rawData.map((row) => ({
          Cedula: String(row["cedula"] || row["Cédula"] || row["CEDULA"] || row["ci"] || "").trim(),
          Nombres: String(row["nombres"] || row["Nombres"] || row["NOMBRES"] || row["nombre"] || "").trim(),
          Apellidos: String(row["apellidos"] || row["Apellidos"] || row["APELLIDOS"] || "").trim(),
          Genero: String(row["genero"] || row["Genero"] || row["GENERO"] || row["sexo"] || "").trim().toUpperCase(),
          GradoAno: String(row["grado_ano"] || row["Grado_Ano"] || row["grado"] || row["Grado"] || row["GRADO"] || "").trim(),
          Seccion: String(row["seccion"] || row["Sección"] || row["SECCION"] || row["seccion_"] || "").trim().toUpperCase(),
          RepresentanteNombre: String(row["representante_nombre"] || row["Representante_Nombre"] || row["nombre_representante"] || row["Representante"] || "").trim(),
          RepresentanteTelefono: String(row["representante_telefono"] || row["Representante_Telefono"] || row["telefono"] || "").trim(),
          RepresentanteCorreo: String(row["representante_correo"] || row["Representante_Correo"] || row["correo_representante"] || row["correo"] || row["email"] || "").trim(),
        }));

        const validRows = normalized.filter(row => row.Cedula && (row.Nombres || row.Apellidos));
        if (validRows.length === 0) {
          setStatus({ type: "error", message: "No se encontraron datos válidos. Descarga la plantilla oficial para ver el formato." });
          return;
        }

        setData(validRows);
        setStatus({ type: "success", message: `Se encontraron ${validRows.length} estudiante(s) en el archivo. Revisa la vista previa y presiona "Importar".` });
      };

      reader.readAsBinaryString(selected);
    } catch {
      setStatus({ type: "error", message: "Error al leer el archivo Excel. Verifica que sea un archivo .xlsx válido." });
    }
  }, []);

  const handleImport = async () => {
    if (data.length === 0 || !file) return;
    setIsUploading(true);
    setProgress(5);
    setStatus({ type: null, message: "" });
    setImportedStudents([]);
    setErroresValidacion([]);

    try {
      const fd = new FormData();
      fd.append("archivo", file);
      setProgress(20);

      const res = await fetch("/api/admin/estudiantes/bulk", { method: "POST", body: fd });
      setProgress(80);
      const resData = await res.json();

      // Errores de validación (422) — mostrar tabla antes de tocar BD
      if (res.status === 422 && resData.errores) {
        setErroresValidacion(resData.errores);
        setStatus({ type: "warn", message: `⚠️ ${resData.errores.length} error(es) de validación encontrados. Corrígelos en el archivo y vuelve a intentar.` });
        setProgress(0);
        return;
      }

      if (!res.ok || !resData.ok) throw new Error(resData.error || "Error al procesar el archivo");

      setProgress(100);
      const { insertados, duplicados, errores } = resData.resumen;
      setStatus({
        type: "success",
        message: `✅ Importación completada — ${insertados} nuevo(s), ${duplicados} duplicado(s) omitido(s)${errores > 0 ? `, ${errores} con error` : ""}.`,
      });

      if (resData.resultados) {
        const ok = resData.resultados.filter((r: { estado: string }) => r.estado === "ok");
        setImportedStudents(ok.map((d: { cedula: string; nombre: string; grado: string; seccion: string }) => ({
          id: d.cedula, qr_code: `RC-${d.cedula}`,
          cedula: d.cedula, nombre: d.nombre, grado: d.grado, seccion: d.seccion,
        })));
      }
    } catch (err: unknown) {
      setStatus({ type: "error", message: (err instanceof Error ? err.message : "Error al importar los datos.") });
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setData([]);
    setStatus({ type: null, message: "" });
    setImportedStudents([]);
    setErroresValidacion([]);
    setProgress(0);
  };

  if (showPrintView) {
    return <CarnetsView students={importedStudents} onClose={() => setShowPrintView(false)} />;
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Carga Masiva y Carnetización</h1>
        <p className="text-slate-400 mt-1 text-xs sm:text-sm">Sube la nómina oficial en Excel y genera carnets con QR automáticos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* ── Panel Izquierdo ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Subir Archivo Excel
            </h2>

            {/* Botón Plantilla Oficial */}
            <button
              onClick={downloadTemplate}
              className="w-full mb-4 py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 transition-all text-sm"
            >
              <Download className="w-4 h-4" />
              📥 Descargar Plantilla Oficial (Excel)
            </button>

            {/* Hint de columnas */}
            <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-white/5 text-[11px] sm:text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300 text-xs">📋 Columnas de la plantilla oficial:</p>
              <p>cedula · nombres · apellidos · genero</p>
              <p>grado_ano · seccion</p>
              <p>representante_nombre · representante_telefono · representante_correo</p>
            </div>

            {/* Drop zone */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-white/10 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FileDown className="w-7 h-7 text-slate-400 mb-2" />
                <p className="mb-1 text-xs sm:text-sm text-slate-300">
                  <span className="font-semibold">Toca para subir</span> el archivo
                </p>
                <p className="text-[10px] text-slate-500">XLSX, XLS (MAX. 10MB)</p>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </label>

            {file && (
              <p className="mt-3 text-xs text-blue-300 text-center font-medium truncate">📄 {file.name}</p>
            )}

            {/* Barra de progreso */}
            {isUploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Importando…</span>
                  <span className="text-xs text-slate-400">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={data.length === 0 || isUploading}
              className={`w-full mt-4 py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all text-sm ${
                data.length === 0 || isUploading
                  ? "bg-slate-700/50 text-slate-400 cursor-not-allowed"
                  : "btn-primary"
              }`}
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</>
              ) : (
                <>Importar a Base de Datos ({data.length})</>
              )}
            </button>

            {/* Mensaje de estado */}
            {status.type && (
              <div className={`mt-4 p-3 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm ${
                status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : status.type === "warn" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {status.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : status.type === "warn" ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <p>{status.message}</p>
              </div>
            )}

            {/* Acciones secundarias */}
            <div className="mt-4 flex flex-col gap-3">
              {importedStudents.length > 0 && (
                <button
                  onClick={() => setShowPrintView(true)}
                  className="w-full py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 bg-gradient-to-r from-sky-500/15 to-blue-500/15 hover:from-sky-500/25 hover:to-blue-500/25 text-white border border-white/10 transition-colors text-sm"
                >
                  <QrCode className="w-5 h-5" /> Ver Carnets ({importedStudents.length})
                </button>
              )}
              {data.length > 0 && (
                <button
                  onClick={resetForm}
                  className="w-full py-2 px-4 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 flex justify-center items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Limpiar y cargar otro archivo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Panel Derecho ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabla de errores de validación */}
          {erroresValidacion.length > 0 && (
            <div className="glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <h2 className="text-base font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Errores de Validación ({erroresValidacion.length})
              </h2>
              <p className="text-xs text-slate-500 mb-3">Corrige los siguientes errores en tu archivo Excel y vuelve a subirlo:</p>
              <div className="overflow-x-auto rounded-xl border border-amber-500/20">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-amber-500/10 text-amber-400 uppercase">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Cédula</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {erroresValidacion.map((e, i) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 font-mono text-amber-300">F{e.fila}</td>
                        <td className="px-3 py-2 font-mono">{e.cedula || "—"}</td>
                        <td className="px-3 py-2 truncate max-w-[120px]">{e.nombre}</td>
                        <td className="px-3 py-2 text-red-400">{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vista Previa */}
          <div className="glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Vista Previa ({data.length})</h2>
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
              <table className="w-full text-xs sm:text-sm text-left text-slate-300">
                <thead className="text-[10px] text-slate-400 uppercase bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2.5">Cédula</th>
                    <th className="px-3 py-2.5">Apellidos y Nombres</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Grado</th>
                    <th className="px-3 py-2.5 hidden md:table-cell">Sección</th>
                    <th className="px-3 py-2.5 hidden lg:table-cell">Representante</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-slate-500 text-xs">
                        <div className="space-y-2">
                          <p className="italic">Sube un archivo para previsualizar los datos aquí.</p>
                          <p className="text-[10px] text-slate-600">💡 Descarga la plantilla oficial para ver el formato correcto</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-white text-xs">{row.Cedula}</td>
                        <td className="px-3 py-2.5 text-xs">{row.Apellidos} {row.Nombres}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell text-xs">{row.GradoAno}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-xs">{row.Seccion}</td>
                        <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-slate-500 truncate max-w-[140px]">{row.RepresentanteNombre}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {data.length > 25 && (
                <div className="p-2.5 text-center text-[10px] text-slate-500 border-t border-white/5">
                  Mostrando los primeros 25 de {data.length} registros
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vista de Carnets ──────────────────────────────────────────────────────────

function CarnetsView({ students, onClose }: { students: ImportedStudent[]; onClose: () => void }) {
  const [QRComponent, setQRComponent] = useState<React.ComponentType<{ value: string; size: number; level: string; includeMargin: boolean }> | null>(null);

  useEffect(() => {
    import("qrcode.react").then((mod) => {
      setQRComponent(() => mod.QRCodeSVG as React.ComponentType<{ value: string; size: number; level: string; includeMargin: boolean }>);
    });
  }, []);

  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-8 absolute inset-0 z-50 overflow-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 print:hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">🎓 Carnets Digitales</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" /> Imprimir
          </button>
          <button onClick={onClose} className="px-3 sm:px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors text-sm">
            Cerrar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 print:grid-cols-2 print:gap-4">
        {students.map((est) => (
          <div
            key={est.id}
            className="border-2 border-blue-800 rounded-xl p-4 flex flex-col items-center text-center space-y-3 break-inside-avoid shadow-lg relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-r from-blue-800 to-blue-700 flex items-center justify-center">
              <h2 className="text-white font-bold tracking-wider text-[10px] sm:text-xs">UE COLEGIO RAFAEL CASTILLO</h2>
            </div>
            <div className="pt-16">
              {QRComponent ? (
                <QRComponent value={est.qr_code} size={110} level="H" includeMargin />
              ) : (
                <div className="w-[110px] h-[110px] bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-blue-950 uppercase leading-tight">{est.nombre}</h3>
              <p className="text-slate-600 font-medium mt-1 text-xs">C.I: {est.cedula}</p>
              <div className="mt-2 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold text-xs">
                {est.grado} &ldquo;{est.seccion}&rdquo;
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
