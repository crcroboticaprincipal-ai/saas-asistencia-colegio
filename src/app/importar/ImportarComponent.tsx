"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, FileDown, CheckCircle, AlertCircle, Printer, QrCode, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type EstudianteRow = {
  Cedula: string;
  Nombre_Completo: string;
  Grado: string;
  Seccion: string;
  Nombre_Representante: string;
  Correo_Representante: string;
};

type ImportedStudent = {
  id: string;
  qr_code: string;
  cedula: string;
  nombre: string;
  grado: string;
  seccion: string;
};

/**
 * Genera un QR code único basado en la cédula del estudiante + UUID v4.
 * Formato: RC-{CEDULA}-{UUID} 
 * RC = Rafael Castillo (prefix institucional)
 * Garantiza unicidad absoluta incluso si se importa el mismo alumno varias veces.
 */
function generateUniqueQR(cedula: string): string {
  // UUID v4 generado con crypto.randomUUID si disponible, fallback manual
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  return `RC-${cedula.trim()}-${uuid}`;
}

export default function ImportarComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<EstudianteRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [showPrintView, setShowPrintView] = useState(false);
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setStatus({ type: null, message: "" });

    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const normalized: EstudianteRow[] = rawData.map((row) => ({
          Cedula: String(row["Cédula"] || row["Cedula"] || row["cedula"] || "").trim(),
          Nombre_Completo: String(row["Nombre Completo"] || row["Nombre_Completo"] || row["nombre_completo"] || "").trim(),
          Grado: String(row["Grado"] || row["grado"] || "").trim(),
          Seccion: String(row["Seccion"] || row["Sección"] || row["seccion"] || row["sección"] || "").trim(),
          Nombre_Representante: String(row["Nombre Representante"] || row["Nombre_Representante"] || row["nombre_representante"] || "").trim(),
          Correo_Representante: String(row["Correo Representante"] || row["Correo_Representante"] || row["correo_representante"] || "").trim(),
        }));

        // Filter out empty rows
        const validRows = normalized.filter(row => row.Cedula && row.Nombre_Completo);
        setData(validRows);
      };

      reader.readAsBinaryString(selected);
    } catch {
      setStatus({ type: "error", message: "Error al leer el archivo Excel." });
    }
  }, []);

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsUploading(true);
    setStatus({ type: null, message: "" });
    setImportedStudents([]);

    try {
      // Check for duplicate cedulas in the upload
      const cedulaSet = new Set<string>();
      const duplicates: string[] = [];
      for (const row of data) {
        if (cedulaSet.has(row.Cedula)) {
          duplicates.push(row.Cedula);
        }
        cedulaSet.add(row.Cedula);
      }

      if (duplicates.length > 0) {
        throw new Error(`Cédulas duplicadas en el archivo: ${duplicates.join(', ')}. Corrige el Excel.`);
      }

      const recordsToInsert = data.map((row) => ({
        cedula: row.Cedula,
        nombre_completo: row.Nombre_Completo,
        grado: row.Grado,
        seccion: row.Seccion,
        nombre_representante: row.Nombre_Representante,
        correo_representante: row.Correo_Representante,
        qr_code: generateUniqueQR(row.Cedula),
      }));

      const { data: insertedData, error } = await supabase
        .from("estudiantes")
        .upsert(recordsToInsert, { onConflict: "cedula", ignoreDuplicates: false })
        .select();

      if (error) throw error;

      setStatus({ type: "success", message: `✅ Se importaron ${data.length} estudiantes correctamente. QR generados automáticamente.` });

      if (insertedData) {
        setImportedStudents(
          insertedData.map((d) => ({
            id: d.id,
            qr_code: d.qr_code,
            cedula: d.cedula,
            nombre: d.nombre_completo,
            grado: d.grado,
            seccion: d.seccion,
          }))
        );
      }
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Error al importar los datos." });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setData([]);
    setStatus({ type: null, message: "" });
    setImportedStudents([]);
  };

  // ── Print View (Carnets) ──
  if (showPrintView) {
    return <CarnetsView students={importedStudents} onClose={() => setShowPrintView(false)} />;
  }

  // ── Main View ──
  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Carga Masiva y Carnetización</h1>
        <p className="text-slate-400 mt-1 text-xs sm:text-sm">Sube la nómina en Excel y genera carnets con QR automáticos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Panel – Upload */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <div className="glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Subir Archivo Excel
            </h2>

            <label className="flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-white/10 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-colors active:scale-[0.98]">
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FileDown className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400 mb-2" />
                <p className="mb-1 text-xs sm:text-sm text-slate-300">
                  <span className="font-semibold">Toca para subir</span> el archivo
                </p>
                <p className="text-[10px] sm:text-xs text-slate-500">XLSX, XLS (MAX. 10MB)</p>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </label>

            {file && (
              <p className="mt-3 text-xs sm:text-sm text-blue-300 text-center font-medium truncate">📄 {file.name}</p>
            )}

            <button
              onClick={handleImport}
              disabled={data.length === 0 || isUploading}
              className={`w-full mt-4 sm:mt-6 py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all text-sm ${
                data.length === 0 || isUploading
                  ? "bg-slate-700/50 text-slate-400 cursor-not-allowed"
                  : "btn-primary"
              }`}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Importando…
                </span>
              ) : (
                <>Importar a Base de Datos ({data.length})</>
              )}
            </button>

            {/* Status Message */}
            {status.type && (
              <div
                className={`mt-4 p-3 sm:p-4 rounded-xl flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm ${
                  status.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
                )}
                <p>{status.message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-3">
              {importedStudents.length > 0 && (
                <button
                  onClick={() => setShowPrintView(true)}
                  className="w-full py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 bg-gradient-to-r from-sky-500/15 to-blue-500/15 hover:from-sky-500/25 hover:to-blue-500/25 text-white border border-white/10 transition-colors text-sm"
                >
                  <QrCode className="w-5 h-5" />
                  Ver Carnets ({importedStudents.length})
                </button>
              )}

              {data.length > 0 && (
                <button
                  onClick={resetForm}
                  className="w-full py-2 px-4 rounded-xl text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 flex justify-center items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Limpiar y cargar otro archivo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel – Preview Table */}
        <div className="lg:col-span-2 glass-panel p-4 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Vista Previa ({data.length})</h2>

          <div className="flex-1 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50 -mx-1">
            <table className="w-full text-xs sm:text-sm text-left text-slate-300">
              <thead className="text-[10px] sm:text-xs text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-3">Cédula</th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-3">Nombre</th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-3 hidden sm:table-cell">Grado</th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-3 hidden md:table-cell">Sección</th>
                  <th className="px-3 sm:px-6 py-2.5 sm:py-3 hidden lg:table-cell">Representante</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-6 py-10 sm:py-12 text-center text-slate-500 italic text-xs sm:text-sm">
                      Sube un archivo para previsualizar los datos aquí.
                    </td>
                  </tr>
                ) : (
                  data.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 font-medium text-white text-xs">{row.Cedula}</td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 text-xs">{row.Nombre_Completo}</td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 hidden sm:table-cell text-xs">{row.Grado}</td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 hidden md:table-cell text-xs">{row.Seccion}</td>
                      <td className="px-3 sm:px-6 py-2.5 sm:py-3 hidden lg:table-cell text-xs text-slate-500 truncate max-w-[140px]">{row.Nombre_Representante}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data.length > 20 && (
              <div className="p-2.5 sm:p-3 text-center text-[10px] sm:text-xs text-slate-500 border-t border-white/5">
                Mostrando los primeros 20 de {data.length} registros
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Carnets Print Sub-View ──
function CarnetsView({ students, onClose }: { students: ImportedStudent[]; onClose: () => void }) {
  const [QRComponent, setQRComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import("qrcode.react").then((mod) => {
      setQRComponent(() => mod.QRCodeSVG);
    });
  }, []);

  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-8 absolute inset-0 z-50 overflow-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-8 print:hidden">
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
            className="border-2 border-blue-800 rounded-xl p-4 sm:p-6 flex flex-col items-center text-center space-y-3 sm:space-y-4 break-inside-avoid shadow-lg relative overflow-hidden"
          >
            {/* Header */}
            <div className="absolute top-0 inset-x-0 h-12 sm:h-16 bg-gradient-to-r from-blue-800 to-blue-700 flex items-center justify-center">
              <h2 className="text-white font-bold tracking-wider text-[10px] sm:text-sm">UE COLEGIO RAFAEL CASTILLO</h2>
            </div>
            {/* QR Code */}
            <div className="pt-14 sm:pt-20">
              {QRComponent ? (
                <QRComponent value={est.qr_code} size={120} level="H" includeMargin className="p-1.5 sm:p-2 bg-white rounded-lg border shadow-sm" />
              ) : (
                <div className="w-[120px] h-[120px] bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>
            {/* Info */}
            <div>
              <h3 className="font-bold text-base sm:text-lg text-blue-950 uppercase leading-tight">{est.nombre}</h3>
              <p className="text-slate-600 font-medium mt-1 text-xs sm:text-sm">C.I: {est.cedula}</p>
              <div className="mt-2 sm:mt-3 inline-block px-3 sm:px-4 py-1 bg-blue-100 text-blue-800 rounded-full font-bold text-xs sm:text-sm">
                {est.grado} &ldquo;{est.seccion}&rdquo;
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
