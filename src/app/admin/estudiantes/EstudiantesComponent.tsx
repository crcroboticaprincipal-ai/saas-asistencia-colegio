"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Printer,
  QrCode,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  X,
  Save,
  Camera,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Zap,
  Filter,
  GraduationCap,
  ArrowUpCircle,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";
import * as XLSX from "xlsx";

type Estudiante = {
  id: string;
  qr_code: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
  estado: "Activo" | "Retirado" | "Graduado";
  foto_url?: string | null;
  institucion_id: string;
};

const PAGE_SIZE = 50;

type BulkResultado = {
  fila: number;
  nombre: string;
  cedula: string;
  estado: "ok" | "error" | "duplicado";
  mensaje?: string;
};

type BulkResumen = {
  total: number;
  insertados: number;
  duplicados: number;
  errores: number;
};

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

// ── Toast Component ──
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-medium animate-slide-up ${
            t.type === "success"
              ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-200"
              : "bg-rose-900/90 border-rose-500/30 text-rose-200"
          }`}
          style={{ maxWidth: 420 }}
        >
          {t.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EstudiantesComponent() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPrintView, setShowPrintView] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Estudiante[]>([]);

  // Hierarchical filters
  const [filterGrado, setFilterGrado] = useState("");
  const [filterSeccion, setFilterSeccion] = useState("");
  const [gradoOptions, setGradoOptions] = useState<string[]>([]);
  const [seccionOptions, setSeccionOptions] = useState<string[]>([]);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [formData, setFormData] = useState<Partial<Estudiante>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResumen, setBulkResumen] = useState<BulkResumen | null>(null);
  const [bulkResultados, setBulkResultados] = useState<BulkResultado[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Bulk section modal
  const [showSeccionModal, setShowSeccionModal] = useState(false);
  const [seccionAccion, setSeccionAccion] = useState<"promover" | "graduar">("promover");
  const [seccionGradoDestino, setSeccionGradoDestino] = useState("");
  const [seccionSeccionDestino, setSeccionSeccionDestino] = useState("");
  const [seccionConfirm, setSeccionConfirm] = useState("");
  const [seccionLoading, setSeccionLoading] = useState(false);

  // Bulk photo upload state
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoDragOver, setFotoDragOver] = useState(false);
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoProgress, setFotoProgress] = useState(0);   // 0-100
  const [fotoResultados, setFotoResultados] = useState<
    { nombre: string; cedula: string; estado: 'ok' | 'no_encontrado' | 'error'; mensaje?: string }[]
  >([]);
  const [fotoDone, setFotoDone] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEstudiantes = useCallback(
    async (page = 0, search = "", grado = "", seccion = "") => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          ...(search ? { search } : {}),
          ...(grado ? { grado } : {}),
          ...(seccion ? { seccion } : {}),
        });
        const res = await fetch(`/api/admin/estudiantes?${params}`);
        const resData = await res.json();
        if (resData.ok && resData.data) {
          setEstudiantes(resData.data as Estudiante[]);
          setTotalEstudiantes(resData.total ?? 0);
        } else {
          console.error("Error fetching students:", resData.error);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch distinct grado/seccion options for filter dropdowns
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/estudiantes/filter-options");
      const data = await res.json();
      if (data.ok) {
        setGradoOptions(data.grados ?? []);
        setSeccionOptions(data.secciones ?? []);
      }
    } catch {
      // silently fail — filters will be empty dropdowns
    }
  }, []);

  useEffect(() => {
    fetchEstudiantes(0, "", "", "");
    fetchFilterOptions();
  }, [fetchEstudiantes, fetchFilterOptions]);

  const handleOpenModal = (student?: Estudiante) => {
    if (student) {
      setEditingStudent(student);
      setFormData(student);
    } else {
      setEditingStudent(null);
      setFormData({
        cedula: "",
        nombre_completo: "",
        grado: "",
        seccion: "",
        nombre_representante: "",
        correo_representante: "",
        estado: "Activo",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    setFormData({});
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanCedula = formData.cedula?.trim().toUpperCase().replace(/\s+/g, "") || "";
      const qrCode = `RC-${cleanCedula}`;

      const studentData = {
        cedula: formData.cedula?.trim(),
        nombre_completo: formData.nombre_completo?.trim(),
        grado: formData.grado?.trim(),
        seccion: formData.seccion?.trim().toUpperCase(),
        nombre_representante: formData.nombre_representante?.trim(),
        correo_representante: formData.correo_representante?.trim(),
        qr_code: qrCode,
        estado: formData.estado || "Activo",
        foto_url: formData.foto_url || null,
      };

      if (editingStudent) {
        const res = await fetch("/api/admin/estudiantes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingStudent.id, ...studentData }),
        });
        const resData = await res.json();
        if (!res.ok || !resData.ok) {
          throw new Error(resData.error || "Error al actualizar estudiante");
        }
      } else {
        const res = await fetch("/api/admin/estudiantes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studentData),
        });
        const resData = await res.json();
        if (!res.ok || !resData.ok) {
          throw new Error(resData.error || "Error al crear estudiante");
        }
      }

      await fetchEstudiantes(currentPage, searchTerm, filterGrado, filterSeccion);
      handleCloseModal();
      showToast(
        editingStudent
          ? `✅ Estudiante "${formData.nombre_completo}" actualizado.`
          : `✅ Estudiante "${formData.nombre_completo}" registrado.`
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error al guardar los datos del estudiante.";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingStudent?.id) return;
    setUploadingPhoto(true);
    try {
      const institucion_id = editingStudent.institucion_id;
      const filePath = `${institucion_id}/${editingStudent.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("fotos-estudiantes")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from("fotos-estudiantes")
        .getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, foto_url: urlData.publicUrl }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al subir foto";
      showToast("Error al subir foto: " + msg, "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const currentEstudiantes = estudiantes;
  const totalPages = Math.ceil(totalEstudiantes / PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(0);
      fetchEstudiantes(0, value, filterGrado, filterSeccion);
    }, 400);
  };

  const handleFilterChange = (newGrado: string, newSeccion: string) => {
    setFilterGrado(newGrado);
    setFilterSeccion(newSeccion);
    setCurrentPage(0);
    fetchEstudiantes(0, searchTerm, newGrado, newSeccion);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchEstudiantes(newPage, searchTerm, filterGrado, filterSeccion);
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === currentEstudiantes.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents([...currentEstudiantes]);
    }
  };

  const toggleStudent = (student: Estudiante) => {
    if (selectedStudents.some((s) => s.id === student.id)) {
      setSelectedStudents(selectedStudents.filter((s) => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  // ── Bulk Upload handlers ──
  const descargarPlantilla = () => {
    const cabeceras = [
      [
        "cedula",
        "nombre_completo",
        "grado",
        "seccion",
        "nombre_representante",
        "correo_representante",
        "estado",
      ],
    ];
    const ejemplos = [
      [
        "34123456",
        "JUAN CARLOS PÉREZ GARCÍA",
        "5T",
        "A",
        "MARIA GARCÍA",
        "maria@gmail.com",
        "Activo",
      ],
      [
        "34123457",
        "ANA SOFÍA RODRÍGUEZ LÓPEZ",
        "5T",
        "B",
        "PEDRO RODRÍGUEZ",
        "pedro@hotmail.com",
        "Activo",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...cabeceras, ...ejemplos]);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 8 },
      { wch: 8 },
      { wch: 30 },
      { wch: 32 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");
    XLSX.writeFile(wb, "plantilla_estudiantes_asisto.xlsx");
  };

  const handleBulkFileSelect = (file: File) => {
    setBulkFile(file);
    setBulkResumen(null);
    setBulkResultados([]);
  };

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleBulkFileSelect(file);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkResumen(null);
    setBulkResultados([]);
    try {
      const fd = new FormData();
      fd.append("archivo", bulkFile);
      const res = await fetch("/api/admin/estudiantes/bulk", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al procesar el archivo");
      setBulkResumen(data.resumen);
      setBulkResultados(data.resultados);
      if (data.resumen.insertados > 0) {
        await fetchEstudiantes(0, "", "", "");
        setCurrentPage(0);
        setSearchTerm("");
        setFilterGrado("");
        setFilterSeccion("");
        await fetchFilterOptions();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setBulkResumen({ total: 0, insertados: 0, duplicados: 0, errores: 1 });
      setBulkResultados([{ fila: 0, nombre: "", cedula: "", estado: "error", mensaje: msg }]);
    } finally {
      setBulkUploading(false);
    }
  };

  // ── Bulk Section Action ──
  const handleSeccionBulk = async () => {
    if (seccionConfirm !== "PROMOVER") {
      showToast('Debes escribir exactamente "PROMOVER" para confirmar.', "error");
      return;
    }
    if (!filterGrado || !filterSeccion) {
      showToast("Selecciona un Grado y Sección en los filtros antes de ejecutar esta acción.", "error");
      return;
    }
    if (seccionAccion === "promover" && (!seccionGradoDestino || !seccionSeccionDestino)) {
      showToast("Debes indicar el Grado destino y la Sección destino.", "error");
      return;
    }

    setSeccionLoading(true);
    try {
      const res = await fetch("/api/admin/estudiantes/seccion-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: seccionAccion,
          institucion_id: currentEstudiantes[0]?.institucion_id ?? "",
          grado_origen: filterGrado,
          seccion_origen: filterSeccion,
          nuevo_grado: seccionGradoDestino.trim(),
          nueva_seccion: seccionSeccionDestino.trim(),
          confirmacion: seccionConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error en la operación masiva.");

      showToast(data.message, "success");
      setShowSeccionModal(false);
      setSeccionConfirm("");
      setSeccionGradoDestino("");
      setSeccionSeccionDestino("");
      // Refresh list & filter options
      await fetchEstudiantes(0, searchTerm, filterGrado, filterSeccion);
      await fetchFilterOptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      showToast(msg, "error");
    } finally {
      setSeccionLoading(false);
    }
  };

  const openSeccionModal = () => {
    if (!filterGrado || !filterSeccion) {
      showToast("Primero selecciona un Grado y una Sección en los filtros.", "error");
      return;
    }
    setSeccionConfirm("");
    setSeccionGradoDestino("");
    setSeccionSeccionDestino("");
    setSeccionAccion("promover");
    setShowSeccionModal(true);
  };

  // ── Bulk Photo Upload ──
  const handleBulkPhotoUpload = async () => {
    if (fotoFiles.length === 0) return;
    setFotoUploading(true);
    setFotoProgress(0);
    setFotoResultados([]);
    setFotoDone(false);

    try {
      // 1. Load cedula → {id, institucion_id} map from server
      const mapRes = await fetch("/api/admin/estudiantes/cedula-map");
      const mapData = await mapRes.json();
      if (!mapData.ok) throw new Error(mapData.error || "Error al cargar mapa de cédulas");
      const cedulaMap: Record<string, { id: string; institucion_id: string; cedula: string }> =
        mapData.map;

      const results: typeof fotoResultados = [];
      const total = fotoFiles.length;

      for (let i = 0; i < total; i++) {
        const file = fotoFiles[i];
        // Extract cedula from filename: strip extension and any V-, v- prefix
        const rawName = file.name.replace(/\.[^.]+$/, "").trim(); // remove extension
        const normalized = rawName.replace(/[^0-9]/g, "");        // digits only

        const student = cedulaMap[normalized];
        if (!student) {
          results.push({
            nombre: file.name,
            cedula: rawName,
            estado: "no_encontrado",
            mensaje: `Ningún alumno activo tiene la cédula "${rawName}"`,
          });
          setFotoProgress(Math.round(((i + 1) / total) * 100));
          setFotoResultados([...results]);
          continue;
        }

        try {
          // 2. Upload to Supabase Storage
          const filePath = `${student.institucion_id}/${student.id}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("fotos-estudiantes")
            .upload(filePath, file, { upsert: true, contentType: "image/jpeg" });
          if (upErr) throw new Error(upErr.message);

          // 3. Get public URL
          const { data: urlData } = supabase.storage
            .from("fotos-estudiantes")
            .getPublicUrl(filePath);

          // 4. Update foto_url via API
          const updateRes = await fetch("/api/admin/estudiantes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: student.id, foto_url: urlData.publicUrl }),
          });
          const updateData = await updateRes.json();
          if (!updateRes.ok || !updateData.ok) throw new Error(updateData.error || "Error al actualizar");

          results.push({
            nombre: updateData.data?.nombre_completo ?? student.cedula,
            cedula: student.cedula,
            estado: "ok",
          });
        } catch (err: unknown) {
          results.push({
            nombre: file.name,
            cedula: student.cedula,
            estado: "error",
            mensaje: err instanceof Error ? err.message : "Error desconocido",
          });
        }

        setFotoProgress(Math.round(((i + 1) / total) * 100));
        setFotoResultados([...results]);
      }

      // Refresh student list to show new photos
      await fetchEstudiantes(currentPage, searchTerm, filterGrado, filterSeccion);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error en carga masiva de fotos", "error");
    } finally {
      setFotoUploading(false);
      setFotoDone(true);
    }
  };

  const openFotoModal = () => {
    setFotoFiles([]);
    setFotoProgress(0);
    setFotoResultados([]);
    setFotoDone(false);
    setShowFotoModal(true);
  };

  if (showPrintView && selectedStudents.length > 0) {
    return <CarnetsView students={selectedStudents} onClose={() => setShowPrintView(false)} />;
  }

  const activeFilters = filterGrado || filterSeccion;

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Estudiantes
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Gestiona alumnos, códigos QR y correos de notificación.
          </p>
        </div>
        <div className="flex flex-wrap w-full sm:w-auto gap-3">
          <button
            onClick={openSeccionModal}
            className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 text-sm flex-1 sm:flex-none"
          >
            <Zap className="w-4 h-4" />
            Acciones Masivas
          </button>
          <button
            onClick={openFotoModal}
            className="px-4 py-2 bg-sky-600 text-white hover:bg-sky-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20 text-sm flex-1 sm:flex-none"
          >
            <ImageIcon className="w-4 h-4" />
            Fotos Masivas
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-violet-600 text-white hover:bg-violet-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 text-sm flex-1 sm:flex-none"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Carga Masiva
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-sm flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            Añadir Alumno
          </button>
          <button
            onClick={() => setShowPrintView(true)}
            disabled={selectedStudents.length === 0}
            className={`px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-all text-sm flex-1 sm:flex-none ${
              selectedStudents.length === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20"
            }`}
          >
            <Printer className="w-4 h-4" />
            Imprimir ({selectedStudents.length})
          </button>
        </div>
      </div>

      {/* ── Bento Filter Panel ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="sm:col-span-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
          />
        </div>

        {/* Grado filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={filterGrado}
            onChange={(e) => handleFilterChange(e.target.value, filterSeccion)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm appearance-none cursor-pointer"
          >
            <option value="">Todos los Grados</option>
            {gradoOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Sección filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={filterSeccion}
            onChange={(e) => handleFilterChange(filterGrado, e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm appearance-none cursor-pointer"
          >
            <option value="">Todas las Secciones</option>
            {seccionOptions.map((s) => (
              <option key={s} value={s}>
                Sección {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filter badge */}
      {activeFilters && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Filtrando por:
            {filterGrado && (
              <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded-full text-amber-300">
                {filterGrado}
              </span>
            )}
            {filterSeccion && (
              <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/25 rounded-full text-amber-300">
                Sección {filterSeccion}
              </span>
            )}
          </span>
          <button
            onClick={() => handleFilterChange("", "")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Table Panel ── */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl">
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={
                      selectedStudents.length > 0 &&
                      selectedStudents.length === currentEstudiantes.length
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                </th>
                <th className="px-4 py-3 w-12">Foto</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Grado</th>
                <th className="px-4 py-3">Sección</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 hidden md:table-cell">Correo Representante</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : currentEstudiantes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 italic">
                    No se encontraron estudiantes
                  </td>
                </tr>
              ) : (
                currentEstudiantes.map((estudiante) => (
                  <tr
                    key={estudiante.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedStudents.some((s) => s.id === estudiante.id)}
                        onChange={() => toggleStudent(estudiante)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {estudiante.foto_url ? (
                        <Image
                          src={estudiante.foto_url}
                          alt={estudiante.nombre_completo}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-full object-cover border border-white/10 mx-auto"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center mx-auto text-slate-500 text-xs font-bold">
                          {estudiante.nombre_completo[0]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{estudiante.cedula}</td>
                    <td className="px-4 py-3">{estudiante.nombre_completo}</td>
                    <td className="px-4 py-3">{estudiante.grado}</td>
                    <td className="px-4 py-3">{estudiante.seccion}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-full font-bold border ${
                          estudiante.estado === "Activo"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : estudiante.estado === "Retirado"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {estudiante.estado || "Activo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                      {estudiante.correo_representante || "-"}
                    </td>
                    <td className="px-4 py-3 text-center space-x-1">
                      <button
                        onClick={() => handleOpenModal(estudiante)}
                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Editar alumno"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStudents([estudiante]);
                          setShowPrintView(true);
                        }}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Imprimir carnet"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación server-side */}
        {!loading && totalEstudiantes > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <div>
              Mostrando {currentPage * PAGE_SIZE + 1}–
              {Math.min((currentPage + 1) * PAGE_SIZE, totalEstudiantes)} de {totalEstudiantes}{" "}
              estudiantes
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 bg-white/5 rounded-lg font-medium text-white">
                {currentPage + 1} / {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Añadir/Editar ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">
                {editingStudent ? "Editar Alumno" : "Añadir Nuevo Alumno"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cédula</label>
                <input
                  required
                  type="text"
                  value={formData.cedula || ""}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ej: V-12345678"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nombre Completo
                </label>
                <input
                  required
                  type="text"
                  value={formData.nombre_completo || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre_completo: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Nombres y Apellidos"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Grado/Año
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.grado || ""}
                    onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ej: 1er Año"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Sección
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.seccion || ""}
                    onChange={(e) => setFormData({ ...formData, seccion: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ej: A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Estado de Matrícula
                </label>
                <select
                  value={formData.estado || "Activo"}
                  onChange={(e) =>
                    setFormData({ ...formData, estado: e.target.value as Estudiante["estado"] })
                  }
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="Activo">🟢 Activo</option>
                  <option value="Retirado">🔴 Retirado (Soft Delete)</option>
                  <option value="Graduado">🔵 Graduado</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nombre del Representante
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.nombre_representante || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre_representante: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Nombre y Apellido"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Correo del Representante
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.correo_representante || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, correo_representante: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              {/* Foto de perfil — solo en edición */}
              {editingStudent && (
                <div className="flex items-center gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/10 flex-shrink-0 bg-slate-700">
                    {formData.foto_url ? (
                      <Image
                        src={formData.foto_url}
                        alt="Foto"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      Foto de Perfil Académica
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                        uploadingPhoto
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      {uploadingPhoto ? "Subiendo..." : "Subir foto"}
                    </label>
                    {formData.foto_url && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, foto_url: null }))}
                        className="ml-2 text-xs text-rose-400 hover:text-rose-300"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Guardando..." : "Guardar Estudiante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Carga Masiva Excel ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-violet-400" />
                  Carga Masiva de Estudiantes
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Sube un archivo Excel o CSV con los datos de los alumnos
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkFile(null);
                  setBulkResumen(null);
                  setBulkResultados([]);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="flex items-center justify-between p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-violet-300">
                    📥 Paso 1 — Descarga la plantilla oficial
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rellena con los datos de tus alumnos y guarda como .xlsx
                  </p>
                </div>
                <button
                  onClick={descargarPlantilla}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ml-4"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-300 mb-2">
                  📤 Paso 2 — Sube el archivo completado
                </p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleBulkDrop}
                  onClick={() => bulkFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-violet-400 bg-violet-500/10"
                      : bulkFile
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <input
                    ref={bulkFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBulkFileSelect(f);
                    }}
                  />
                  {bulkFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                      <p className="text-emerald-300 font-semibold text-sm">{bulkFile.name}</p>
                      <p className="text-slate-500 text-xs">
                        {(bulkFile.size / 1024).toFixed(1)} KB · Click para cambiar
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-slate-500" />
                      <p className="text-slate-400 font-medium text-sm">
                        Arrastra el archivo aquí o haz click
                      </p>
                      <p className="text-slate-600 text-xs">.xlsx · .xls · .csv — máx. 500 alumnos</p>
                    </div>
                  )}
                </div>
              </div>

              {!bulkResumen && (
                <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Columnas requeridas en la plantilla
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { col: "cedula", desc: "Solo números" },
                      { col: "nombre_completo", desc: "Nombres y apellidos" },
                      { col: "grado", desc: "Ej: 5T, 1T" },
                      { col: "seccion", desc: "A, B, C..." },
                      { col: "nombre_representante", desc: "Nombre del rep." },
                      { col: "correo_representante", desc: "Email válido" },
                    ].map(({ col, desc }) => (
                      <div key={col} className="bg-slate-900/50 rounded-lg px-3 py-2">
                        <p className="text-violet-300 text-xs font-mono font-semibold">{col}</p>
                        <p className="text-slate-500 text-[10px]">{desc}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    La columna{" "}
                    <span className="text-slate-400 font-mono">estado</span> es opcional
                    (Activo por defecto). El QR se genera automáticamente.
                  </p>
                </div>
              )}

              {bulkResumen && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-800/60 rounded-xl p-3 text-center border border-white/5">
                      <p className="text-2xl font-bold text-white">{bulkResumen.total}</p>
                      <p className="text-xs text-slate-400 mt-1">Total filas</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                      <p className="text-2xl font-bold text-emerald-400">
                        {bulkResumen.insertados}
                      </p>
                      <p className="text-xs text-emerald-500 mt-1">Insertados</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-xl p-3 text-center border border-amber-500/20">
                      <p className="text-2xl font-bold text-amber-400">
                        {bulkResumen.duplicados}
                      </p>
                      <p className="text-xs text-amber-500 mt-1">Duplicados</p>
                    </div>
                    <div className="bg-rose-500/10 rounded-xl p-3 text-center border border-rose-500/20">
                      <p className="text-2xl font-bold text-rose-400">{bulkResumen.errores}</p>
                      <p className="text-xs text-rose-500 mt-1">Errores</p>
                    </div>
                  </div>

                  {bulkResultados.filter((r) => r.estado !== "ok").length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2 border-b border-white/5">
                        Detalle de errores y duplicados
                      </p>
                      <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {bulkResultados
                          .filter((r) => r.estado !== "ok")
                          .map((r, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-2">
                              {r.estado === "error" ? (
                                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-white truncate">
                                  {r.nombre || r.cedula || `Fila ${r.fila}`}
                                </p>
                                <p className="text-[10px] text-slate-500">{r.mensaje}</p>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                  r.estado === "error"
                                    ? "bg-rose-500/20 text-rose-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {r.estado}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {bulkResumen.insertados > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <p className="text-sm text-emerald-300 font-medium">
                        ¡{bulkResumen.insertados} estudiante
                        {bulkResumen.insertados !== 1 ? "s" : ""} registrado
                        {bulkResumen.insertados !== 1 ? "s" : ""} exitosamente!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 flex-shrink-0">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkFile(null);
                  setBulkResumen(null);
                  setBulkResultados([]);
                }}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors text-sm"
              >
                {bulkResumen ? "Cerrar" : "Cancelar"}
              </button>
              {!bulkResumen && (
                <button
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || bulkUploading}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-2 transition-all text-sm"
                >
                  {bulkUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Subir y Registrar
                    </>
                  )}
                </button>
              )}
              {bulkResumen && bulkResumen.errores === 0 && bulkResumen.duplicados === 0 && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Todo procesado sin errores
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Carga Masiva de Fotos ── */}
      {showFotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-sky-400" />
                  Carga Masiva de Fotos
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Sube todas las fotos a la vez — el sistema las asigna automáticamente por cédula
                </p>
              </div>
              <button
                onClick={() => { if (!fotoUploading) setShowFotoModal(false); }}
                disabled={fotoUploading}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Instrucciones */}
              {!fotoDone && (
                <div className="p-4 bg-sky-950/40 border border-sky-500/20 rounded-xl space-y-2">
                  <p className="text-sky-300 text-sm font-semibold flex items-center gap-2">
                    <span className="text-base">📋</span> Instrucciones antes de subir
                  </p>
                  <ul className="text-slate-400 text-xs space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 font-bold flex-shrink-0">1.</span>
                      Nombra cada foto con la <strong className="text-white">cédula del alumno</strong> (solo los números)
                    </li>
                    <li className="flex items-start gap-2 pl-4">
                      Ejemplos válidos:{" "}
                      <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300">34123456.jpg</code>{" "}
                      <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300">V-34123456.jpg</code>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 font-bold flex-shrink-0">2.</span>
                      Formato recomendado: <strong className="text-white">JPG</strong> — máx. 500 KB por foto
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 font-bold flex-shrink-0">3.</span>
                      Selecciona <strong className="text-white">todas las fotos a la vez</strong> en el área de abajo
                    </li>
                  </ul>
                </div>
              )}

              {/* Drop zone */}
              {!fotoUploading && !fotoDone && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setFotoDragOver(true); }}
                  onDragLeave={() => setFotoDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setFotoDragOver(false);
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                    setFotoFiles(files);
                  }}
                  onClick={() => fotoInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    fotoDragOver
                      ? "border-sky-400 bg-sky-500/10"
                      : fotoFiles.length > 0
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <input
                    ref={fotoInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFotoFiles(Array.from(e.target.files ?? []))}
                  />
                  {fotoFiles.length > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="w-10 h-10 text-emerald-400" />
                      <p className="text-emerald-300 font-semibold text-sm">
                        {fotoFiles.length} foto{fotoFiles.length !== 1 ? "s" : ""} seleccionada{fotoFiles.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {(fotoFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB · Click para cambiar
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-slate-500" />
                      <p className="text-slate-400 font-medium text-sm">
                        Arrastra las fotos aquí o haz click para seleccionar
                      </p>
                      <p className="text-slate-600 text-xs">Selecciona múltiples archivos de una sola vez</p>
                    </div>
                  )}
                </div>
              )}

              {/* Progress */}
              {fotoUploading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 font-medium flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      Procesando fotos...
                    </span>
                    <span className="text-sky-400 font-bold">{fotoProgress}%</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${fotoProgress}%` }}
                    />
                  </div>
                  <p className="text-slate-500 text-xs text-center">
                    {fotoResultados.length} de {fotoFiles.length} procesadas
                  </p>
                </div>
              )}

              {/* Results */}
              {fotoResultados.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "✅ Subidas", count: fotoResultados.filter((r) => r.estado === "ok").length, color: "emerald" },
                      { label: "⚠️ No encontradas", count: fotoResultados.filter((r) => r.estado === "no_encontrado").length, color: "amber" },
                      { label: "❌ Errores", count: fotoResultados.filter((r) => r.estado === "error").length, color: "rose" },
                    ].map((s) => (
                      <div key={s.label} className={`bg-${s.color}-500/10 border border-${s.color}-500/20 rounded-xl p-3 text-center`}>
                        <p className={`text-2xl font-bold text-${s.color}-400`}>{s.count}</p>
                        <p className={`text-xs text-${s.color}-600 mt-1`}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {fotoResultados.filter((r) => r.estado !== "ok").length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2 border-b border-white/5">
                        Archivos con problemas
                      </p>
                      <div className="divide-y divide-white/5 max-h-44 overflow-y-auto">
                        {fotoResultados.filter((r) => r.estado !== "ok").map((r, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                            {r.estado === "no_encontrado"
                              ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                              : <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <p className="text-xs text-white truncate font-mono">{r.nombre}</p>
                              <p className="text-[10px] text-slate-500">{r.mensaje}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fotoDone && fotoResultados.filter((r) => r.estado === "ok").length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <p className="text-sm text-emerald-300 font-medium">
                        ¡{fotoResultados.filter((r) => r.estado === "ok").length} foto
                        {fotoResultados.filter((r) => r.estado === "ok").length !== 1 ? "s" : ""} cargada
                        {fotoResultados.filter((r) => r.estado === "ok").length !== 1 ? "s" : ""} exitosamente!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 flex-shrink-0">
              <button
                onClick={() => { if (!fotoUploading) setShowFotoModal(false); }}
                disabled={fotoUploading}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors text-sm disabled:opacity-40"
              >
                {fotoDone ? "Cerrar" : "Cancelar"}
              </button>
              {!fotoDone && (
                <button
                  onClick={handleBulkPhotoUpload}
                  disabled={fotoFiles.length === 0 || fotoUploading}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center gap-2 transition-all text-sm shadow-lg shadow-sky-500/20"
                >
                  {fotoUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                    : <><Upload className="w-4 h-4" /> Subir {fotoFiles.length > 0 ? `${fotoFiles.length} foto${fotoFiles.length !== 1 ? "s" : ""}` : "fotos"}</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Acciones Masivas de Sección ── */}
      {showSeccionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Acciones Masivas de Sección
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Operación sobre{" "}
                  <span className="text-amber-300 font-semibold">
                    {filterGrado} &quot;{filterSeccion}&quot;
                  </span>{" "}
                  — Solo estudiantes Activos serán afectados.
                </p>
              </div>
              <button
                onClick={() => setShowSeccionModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Acción selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSeccionAccion("promover")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    seccionAccion === "promover"
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800/40 border-white/5 text-slate-400 hover:border-white/15"
                  }`}
                >
                  <ArrowUpCircle className="w-7 h-7" />
                  <span className="text-sm font-semibold">Promover / Cambiar Grado</span>
                  <span className="text-[11px] text-center opacity-70">
                    Mueve a los alumnos a otro grado y sección
                  </span>
                </button>
                <button
                  onClick={() => setSeccionAccion("graduar")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    seccionAccion === "graduar"
                      ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                      : "bg-slate-800/40 border-white/5 text-slate-400 hover:border-white/15"
                  }`}
                >
                  <GraduationCap className="w-7 h-7" />
                  <span className="text-sm font-semibold">Graduación Colectiva</span>
                  <span className="text-[11px] text-center opacity-70">
                    Marca a todos como &quot;Graduado&quot;
                  </span>
                </button>
              </div>

              {/* Destino (solo para promover) */}
              {seccionAccion === "promover" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/40 rounded-xl border border-white/5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nuevo Grado / Año
                    </label>
                    <input
                      type="text"
                      value={seccionGradoDestino}
                      onChange={(e) => setSeccionGradoDestino(e.target.value)}
                      placeholder="Ej: 2do Año"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nueva Sección
                    </label>
                    <input
                      type="text"
                      value={seccionSeccionDestino}
                      onChange={(e) => setSeccionSeccionDestino(e.target.value)}
                      placeholder="Ej: B"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Safety warning */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/80 space-y-1">
                  <p className="font-semibold text-amber-300">Acción irreversible</p>
                  <p>
                    Esta operación modifica únicamente los campos de asignación académica
                    (<span className="font-mono text-amber-200">grado</span>,{" "}
                    <span className="font-mono text-amber-200">seccion</span>,{" "}
                    <span className="font-mono text-amber-200">estado</span>). Los registros
                    históricos de asistencia{" "}
                    <strong className="text-amber-300">nunca se alteran</strong>.
                  </p>
                </div>
              </div>

              {/* Confirmation input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Escribe{" "}
                  <span className="font-mono text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded">
                    PROMOVER
                  </span>{" "}
                  para confirmar la operación:
                </label>
                <input
                  type="text"
                  value={seccionConfirm}
                  onChange={(e) => setSeccionConfirm(e.target.value)}
                  placeholder="PROMOVER"
                  className={`w-full bg-slate-800 border rounded-lg px-4 py-2.5 text-white text-sm font-mono tracking-widest focus:outline-none focus:ring-2 transition-all ${
                    seccionConfirm === "PROMOVER"
                      ? "border-emerald-500/50 focus:ring-emerald-500/30"
                      : "border-white/10 focus:ring-amber-500/30"
                  }`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
              <button
                onClick={() => setShowSeccionModal(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSeccionBulk}
                disabled={seccionLoading || seccionConfirm !== "PROMOVER"}
                className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  seccionAccion === "graduar"
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {seccionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ejecutando...
                  </>
                ) : seccionAccion === "promover" ? (
                  <>
                    <ArrowUpCircle className="w-4 h-4" /> Ejecutar Promoción
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4" /> Ejecutar Graduación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Carnets Print Sub-View ──
function CarnetsView({
  students,
  onClose,
}: {
  students: Estudiante[];
  onClose: () => void;
}) {
  const [QRComponent, setQRComponent] = useState<React.ComponentType<{
    value: string;
    size: number;
    level: string;
    includeMargin: boolean;
    className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }> | null>(null);

  useEffect(() => {
    import("qrcode.react").then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQRComponent(() => mod.QRCodeSVG as any);
    });
  }, []);

  return (
    <div className="bg-white text-black min-h-screen p-4 sm:p-8 absolute inset-0 z-50 overflow-auto print:relative print:overflow-visible print:p-0 print:h-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-8 print:hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">🎓 Reposición de Carnets</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors text-sm"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" /> Imprimir ({students.length})
          </button>
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors text-sm"
          >
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
            <div className="absolute top-0 inset-x-0 h-12 sm:h-16 bg-gradient-to-r from-blue-800 to-blue-700 flex items-center justify-center">
              <h2 className="text-white font-bold tracking-wider text-[10px] sm:text-sm">
                UE COLEGIO RAFAEL CASTILLO
              </h2>
            </div>
            <div className="pt-14 sm:pt-20">
              {QRComponent ? (
                <QRComponent
                  value={est.qr_code}
                  size={120}
                  level="H"
                  includeMargin
                  className="p-1.5 sm:p-2 bg-white rounded-lg border shadow-sm"
                />
              ) : (
                <div className="w-[120px] h-[120px] bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-blue-950 uppercase leading-tight">
                {est.nombre_completo}
              </h3>
              <p className="text-slate-600 font-medium mt-1 text-xs sm:text-sm">
                C.I: {est.cedula}
              </p>
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
