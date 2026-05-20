"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, CheckCircle, AlertCircle, XCircle,
  Loader2, UserPlus, RefreshCw, Shield, Eye, EyeOff, ChevronDown,
  ChevronUp, FileSpreadsheet, Users, Save,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmpleadoFila {
  fila: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  correo: string;
  telefono: string;
  cargo: string;
  rol: string;
  username?: string;
  // Set after import
  estado?: "creado" | "duplicado" | "error";
  mensaje?: string;
  // Set during PIN assignment
  pin?: string;
  pinConfirm?: string;
  pinGuardado?: boolean;
  pinError?: string;
  pinSaving?: boolean;
  showPin?: boolean;
}

const ROL_OPTIONS = [
  "docente", "coordinador", "director", "porteria", "administrativo", "obrero",
];

const COLS_TEMPLATE = ["nombres", "apellidos", "cedula", "correo", "telefono", "cargo", "rol"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePin(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function slugUsername(nombres: string, apellidos: string): string {
  const n = (nombres[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const a = (apellidos.split(" ")[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return `${n}${a}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportarPersonalComponent() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<"idle" | "preview" | "results" | "pins">("idle");
  const [rows, setRows] = useState<EmpleadoFila[]>([]);
  const [importing, setImporting] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Stats
  const creados = rows.filter((r) => r.estado === "creado").length;
  const errores = rows.filter((r) => r.estado === "error").length;
  const duplicados = rows.filter((r) => r.estado === "duplicado").length;
  const pinsGuardados = rows.filter((r) => r.pinGuardado).length;

  // ── Excel template download ────────────────────────────────────────────────

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      COLS_TEMPLATE.map((c) => c.toUpperCase()),
      ["María", "González", "12345678", "maria@email.com", "0414-1234567", "Docente de Matemáticas", "docente"],
      ["Carlos", "Pérez López", "87654321", "", "0424-9876543", "Coordinador Académico", "coordinador"],
    ]);
    // Column widths
    ws["!cols"] = COLS_TEMPLATE.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Personal");
    XLSX.writeFile(wb, "plantilla_personal_qrono.xlsx");
  };

  // ── File parse ────────────────────────────────────────────────────────────

  const parseFile = (file: File) => {
    setGlobalError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!raw.length) {
          setGlobalError("El archivo está vacío o no tiene filas de datos.");
          return;
        }

        // Normalize keys
        const parsed: EmpleadoFila[] = raw.map((row, i) => {
          const normalize = (key: string) =>
            (row[key] || row[key.toUpperCase()] || row[key.toLowerCase()] || "").toString().trim();
          const nombres = normalize("nombres");
          const apellidos = normalize("apellidos");
          return {
            fila: i + 2,
            nombres,
            apellidos,
            cedula: normalize("cedula"),
            correo: normalize("correo"),
            telefono: normalize("telefono"),
            cargo: normalize("cargo"),
            rol: normalize("rol") || "docente",
            username: normalize("username") || slugUsername(nombres, apellidos) || `emp${i + 2}`,
          };
        });

        setRows(parsed);
        setStep("preview");
      } catch {
        setGlobalError("No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setGlobalError("");
    try {
      // Fetch institucion_id
      const instRes = await fetch("/api/admin/instituciones");
      const { data: insts } = await instRes.json();
      const inst = insts?.[0];
      if (!inst) throw new Error("No hay instituciones registradas. Crea una primero.");

      const res = await fetch("/api/admin/rrhh/importar-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleados: rows,
          institucion_id: inst.id,
          institucion_nombre_corto: inst.nombre_corto || "CRC",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Merge results back into rows
      const resultMap = new Map(data.resultados.map((r: { fila: number; estado: string; username?: string; mensaje?: string }) => [r.fila, r]));
      setRows((prev) =>
        prev.map((row) => {
          const res: { estado?: string; username?: string; mensaje?: string } = (resultMap.get(row.fila) ?? {}) as { estado?: string; username?: string; mensaje?: string };
          return {
            ...row,
            estado: (res?.estado as EmpleadoFila["estado"]) ?? "error",
            username: res?.username || row.username,
            mensaje: res?.mensaje,
            pin: res?.estado === "creado" ? generatePin() : undefined,
          };
        })
      );
      setStep("results");
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  // ── PIN assignment ────────────────────────────────────────────────────────

  const handleGoToPins = () => {
    setRows((prev) =>
      prev.map((r) =>
        r.estado === "creado" ? { ...r, pin: r.pin || generatePin() } : r
      )
    );
    setStep("pins");
  };

  const updateRow = (fila: number, patch: Partial<EmpleadoFila>) =>
    setRows((prev) => prev.map((r) => (r.fila === fila ? { ...r, ...patch } : r)));

  const handleSavePin = async (row: EmpleadoFila) => {
    if (!row.pin || row.pin.length < 4) {
      updateRow(row.fila, { pinError: "El PIN debe tener al menos 4 dígitos" });
      return;
    }
    if (row.pin !== row.pinConfirm) {
      updateRow(row.fila, { pinError: "Los PINs no coinciden" });
      return;
    }

    updateRow(row.fila, { pinSaving: true, pinError: undefined });

    try {
      const instRes = await fetch("/api/admin/instituciones");
      const { data: insts } = await instRes.json();
      const inst = insts?.[0];
      const nombreCorto = inst?.nombre_corto || "CRC";

      const email = `${row.username}@${nombreCorto.toLowerCase().replace(/[^a-z0-9]/g, "")}.qrono.local`;

      const res = await fetch("/api/admin/crear-usuario-personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          pin: row.pin,
          nombres: row.nombres,
          apellidos: row.apellidos,
          rol: row.rol,
          username: row.username,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateRow(row.fila, { pinGuardado: true, pinSaving: false });
    } catch (err: unknown) {
      updateRow(row.fila, { pinError: err instanceof Error ? err.message : "Error al guardar PIN", pinSaving: false });
    }
  };

  const handleSaveAllPins = async () => {
    const pendientes = rows.filter((r) => r.estado === "creado" && !r.pinGuardado && r.pin);
    for (const row of pendientes) {
      await handleSavePin(row);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-400" />
            Importar Personal (Carga Masiva)
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Sube un Excel con los empleados, revisa, importa y asigna PINs de acceso</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-all border border-white/10 w-full sm:w-auto justify-center"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Descargar Plantilla Excel
        </button>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 text-xs">
        {(["idle", "preview", "results", "pins"] as const).map((s, i) => {
          const labels = ["Subir", "Revisar", "Importados", "Asignar PINs"];
          const active = s === step;
          const done = (["idle", "preview", "results", "pins"] as const).indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all ${
                active ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                done ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                "bg-slate-800/60 text-slate-600 border border-white/5"
              }`}>
                {done ? <CheckCircle className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                {labels[i]}
              </div>
              {i < 3 && <div className="w-4 h-px bg-slate-700" />}
            </div>
          );
        })}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {globalError}
        </div>
      )}

      {/* ── STEP: IDLE — Drop zone ── */}
      {step === "idle" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`glass-panel rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-16 gap-4 ${
            dragging
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.02]"
          }`}
        >
          <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/25 rounded-2xl flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold">Arrastra tu archivo Excel aquí</p>
            <p className="text-slate-500 text-sm mt-1">o haz clic para seleccionar · .xlsx o .csv</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-600">
            {COLS_TEMPLATE.map((c) => (
              <span key={c} className="px-2 py-1 bg-slate-800 rounded-lg">{c}</span>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">{rows.length} empleados detectados</p>
              <p className="text-slate-500 text-sm">Revisa los datos antes de importar</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStep("idle"); setRows([]); }} className="px-4 py-2 text-slate-400 hover:text-white text-sm rounded-xl hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</> : <><Upload className="w-4 h-4" /> Importar {rows.length} Empleados</>}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fila</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Cédula</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Cargo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.fila} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-600 text-xs">{row.fila}</td>
                      <td className="px-4 py-3 text-white font-medium">{row.nombres} {row.apellidos}</td>
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono text-xs">{row.cedula || "—"}</td>
                      <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{row.cargo || "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.rol}
                          onChange={(e) => updateRow(row.fila, { rol: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                        >
                          {ROL_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-300">{row.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: RESULTS ── */}
      {step === "results" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Creados", value: creados, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Duplicados", value: duplicados, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Errores", value: errores, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
            ].map((k) => (
              <div key={k.label} className={`glass-panel p-4 rounded-xl border text-center ${k.bg}`}>
                <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Result table */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase">Empleado</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.fila} className="border-b border-white/[0.03]">
                      <td className="px-4 py-3 text-white">{row.nombres} {row.apellidos}</td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-300">{row.username || "—"}</td>
                      <td className="px-4 py-3">
                        {row.estado === "creado" && (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Creado
                          </span>
                        )}
                        {row.estado === "duplicado" && (
                          <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                            <RefreshCw className="w-3.5 h-3.5" /> Duplicado
                          </span>
                        )}
                        {row.estado === "error" && (
                          <span className="flex items-center gap-1 text-rose-400 text-xs" title={row.mensaje}>
                            <XCircle className="w-3.5 h-3.5" /> {row.mensaje?.slice(0, 40)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {creados > 0 && (
            <button
              onClick={handleGoToPins}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              <Shield className="w-5 h-5" />
              Asignar PINs a los {creados} empleados creados →
            </button>
          )}
        </div>
      )}

      {/* ── STEP: PINS ── */}
      {step === "pins" && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-white font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Asignación de PINs — {creados} empleados
              </p>
              <p className="text-slate-500 text-sm mt-0.5">
                Se generó un PIN aleatorio por empleado. Puedes modificarlo antes de guardar.
                Los empleados usarán <span className="text-indigo-300 font-mono">usuario + PIN</span> para acceder.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleSaveAllPins}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
              >
                <Save className="w-4 h-4" /> Guardar Todos
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> {pinsGuardados} / {creados} PINs guardados
          </div>

          <div className="space-y-2">
            {rows.filter((r) => r.estado === "creado").map((row) => (
              <div key={row.fila} className={`glass-card rounded-xl border transition-all ${
                row.pinGuardado
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-white/[0.06]"
              }`}>
                {/* Row header */}
                <button
                  onClick={() => setExpandedRow(expandedRow === row.fila ? null : row.fila)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      row.pinGuardado ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"
                    }`}>
                      {row.nombres[0]}{row.apellidos[0]}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{row.nombres} {row.apellidos}</p>
                      <p className="text-xs text-slate-500 font-mono">@{row.username} · {row.cargo || row.rol}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.pinGuardado && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {expandedRow === row.fila ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                {/* Expanded PIN form */}
                {expandedRow === row.fila && !row.pinGuardado && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                    {row.pinError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" /> {row.pinError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">PIN (4-6 dígitos)</label>
                        <div className="relative">
                          <input
                            type={row.showPin ? "text" : "password"}
                            value={row.pin || ""}
                            onChange={(e) => updateRow(row.fila, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                            placeholder="••••••"
                            maxLength={6}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-center text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => updateRow(row.fila, { showPin: !row.showPin })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {row.showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Confirmar PIN</label>
                        <input
                          type="password"
                          value={row.pinConfirm || ""}
                          onChange={(e) => updateRow(row.fila, { pinConfirm: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                          placeholder="••••••"
                          maxLength={6}
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-center text-lg tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateRow(row.fila, { pin: generatePin(), pinConfirm: undefined, pinError: undefined })}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Generar
                      </button>
                      <button
                        onClick={() => { updateRow(row.fila, { pinConfirm: row.pin }); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
                      >
                        Auto-confirmar
                      </button>
                      <button
                        onClick={() => handleSavePin(row)}
                        disabled={row.pinSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
                      >
                        {row.pinSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><UserPlus className="w-4 h-4" /> Guardar PIN</>}
                      </button>
                    </div>
                  </div>
                )}

                {expandedRow === row.fila && row.pinGuardado && (
                  <div className="px-4 pb-3 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>PIN configurado · El empleado puede acceder con <span className="font-mono">@{row.username}</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pinsGuardados === creados && creados > 0 && (
            <div className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-sm font-medium">
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
              ¡Listo! Todos los PINs fueron guardados. Los empleados ya pueden iniciar sesión en la Terminal del Docente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
