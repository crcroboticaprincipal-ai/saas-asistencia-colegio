"use client";

import { useState, useCallback } from "react";
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
          Cedula: String(row["Cédula"] || row["Cedula"] || row["cedula"] || ""),
          Nombre_Completo: String(row["Nombre Completo"] || row["Nombre_Completo"] || row["nombre_completo"] || ""),
          Grado: String(row["Grado"] || row["grado"] || ""),
          Seccion: String(row["Seccion"] || row["Sección"] || row["seccion"] || row["sección"] || ""),
          Nombre_Representante: String(row["Nombre Representante"] || row["Nombre_Representante"] || row["nombre_representante"] || ""),
          Correo_Representante: String(row["Correo Representante"] || row["Correo_Representante"] || row["correo_representante"] || ""),
        }));

        setData(normalized);
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
      const recordsToInsert = data.map((row, idx) => {
        // Generar un código QR verdaderamente único por estudiante
        const uniqueId = `${row.Cedula}-${Date.now().toString(36)}-${idx.toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        return {
          cedula: row.Cedula.toString().trim(),
          nombre_completo: row.Nombre_Completo.trim(),
          grado: row.Grado.trim(),
          seccion: row.Seccion.trim(),
          nombre_representante: row.Nombre_Representante.trim(),
          correo_representante: row.Correo_Representante.trim(),
          qr_code: uniqueId,
        };
      });

      const { data: insertedData, error } = await supabase
        .from("estudiantes")
        .upsert(recordsToInsert, { onConflict: "cedula", ignoreDuplicates: false })
        .select();

      if (error) throw error;

      setStatus({ type: "success", message: `✅ Se importaron ${data.length} estudiantes correctamente.` });

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

  // ── Print View (Carnets) ──────────────────────────────────────────
  if (showPrintView) {
    return <CarnetsView students={importedStudents} onClose={() => setShowPrintView(false)} />;
  }

  // ── Main View ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Carga Masiva y Carnetización</h1>
        <p className="text-slate-400 mt-1">Sube la nómina de estudiantes en Excel y genera sus carnets con QR.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel – Upload */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              Subir Archivo Excel
            </h2>

            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-white/10 border-dashed rounded-xl cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileDown className="w-8 h-8 text-slate-400 mb-2" />
                <p className="mb-2 text-sm text-slate-300">
                  <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                </p>
                <p className="text-xs text-slate-500">XLSX, XLS (MAX. 10MB)</p>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </label>

            {file && (
              <p className="mt-3 text-sm text-indigo-300 text-center font-medium truncate">📄 {file.name}</p>
            )}

            <button
              onClick={handleImport}
              disabled={data.length === 0 || isUploading}
              className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all shadow-lg ${
                data.length === 0 || isUploading
                  ? "bg-slate-700/50 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40"
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
                className={`mt-4 p-4 rounded-xl flex items-start gap-3 text-sm ${
                  status.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p>{status.message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-3">
              {importedStudents.length > 0 && (
                <button
                  onClick={() => setShowPrintView(true)}
                  className="w-full py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-white border border-white/10 transition-colors"
                >
                  <QrCode className="w-5 h-5" />
                  Ver y Generar Carnets ({importedStudents.length})
                </button>
              )}

              {data.length > 0 && (
                <button
                  onClick={resetForm}
                  className="w-full py-2 px-4 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 flex justify-center items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Limpiar y cargar otro archivo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel – Preview Table */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4">Vista Previa de Datos ({data.length})</h2>

          <div className="flex-1 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3">Cédula</th>
                  <th className="px-6 py-3">Nombre Completo</th>
                  <th className="px-6 py-3">Grado</th>
                  <th className="px-6 py-3">Sección</th>
                  <th className="px-6 py-3">Representante</th>
                  <th className="px-6 py-3">Correo</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                      Sube un archivo para previsualizar los datos aquí.
                    </td>
                  </tr>
                ) : (
                  data.slice(0, 15).map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-3 font-medium text-white">{row.Cedula}</td>
                      <td className="px-6 py-3">{row.Nombre_Completo}</td>
                      <td className="px-6 py-3">{row.Grado}</td>
                      <td className="px-6 py-3">{row.Seccion}</td>
                      <td className="px-6 py-3">{row.Nombre_Representante}</td>
                      <td className="px-6 py-3 text-xs text-slate-500 truncate max-w-[150px]">{row.Correo_Representante}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data.length > 15 && (
              <div className="p-3 text-center text-xs text-slate-500 border-t border-white/5">
                Mostrando los primeros 15 de {data.length} registros
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Carnets Print Sub-View ────────────────────────────────────────────
function CarnetsView({ students, onClose }: { students: ImportedStudent[]; onClose: () => void }) {
  // Lazy-import QRCodeSVG only on client
  const [QRComponent, setQRComponent] = useState<React.ComponentType<any> | null>(null);

  useState(() => {
    import("qrcode.react").then((mod) => {
      setQRComponent(() => mod.QRCodeSVG);
    });
  });

  return (
    <div className="bg-white text-black min-h-screen p-8 absolute inset-0 z-50 overflow-auto">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">🎓 Carnets Digitales</h1>
        <div className="flex gap-4">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-5 h-5" /> Imprimir
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors">
            Cerrar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
        {students.map((est) => (
          <div
            key={est.id}
            className="border-2 border-indigo-900 rounded-xl p-6 flex flex-col items-center text-center space-y-4 break-inside-avoid shadow-lg relative overflow-hidden"
          >
            {/* Header */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-r from-indigo-900 to-indigo-800 flex items-center justify-center">
              <h2 className="text-white font-bold tracking-wider text-sm">UE COLEGIO RAFAEL CASTILLO</h2>
            </div>
            {/* QR Code */}
            <div className="pt-20">
              {QRComponent ? (
                <QRComponent value={est.qr_code} size={140} level="H" includeMargin className="p-2 bg-white rounded-lg border shadow-sm" />
              ) : (
                <div className="w-[140px] h-[140px] bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>
            {/* Info */}
            <div>
              <h3 className="font-bold text-lg text-indigo-950 uppercase leading-tight">{est.nombre}</h3>
              <p className="text-slate-600 font-medium mt-1">C.I: {est.cedula}</p>
              <div className="mt-3 inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full font-bold text-sm">
                {est.grado} &ldquo;{est.seccion}&rdquo;
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
