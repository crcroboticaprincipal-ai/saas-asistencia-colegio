"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Printer, QrCode, Search, ChevronLeft, ChevronRight, Edit, Plus, X, Save } from "lucide-react";

type Estudiante = {
  id: string;
  qr_code: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
};

export default function EstudiantesComponent() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPrintView, setShowPrintView] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Estudiante[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [formData, setFormData] = useState<Partial<Estudiante>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchEstudiantes();
  }, []);

  const fetchEstudiantes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("estudiantes")
      .select("*")
      .order("nombre_completo");
    
    if (data) {
      setEstudiantes(data as Estudiante[]);
    }
    setLoading(false);
  };

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
        correo_representante: ""
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
      const cleanCedula = formData.cedula?.trim().toUpperCase().replace(/\s+/g, '') || "";
      const qrCode = `RC-${cleanCedula}`;

      const studentData = {
        cedula: formData.cedula?.trim(),
        nombre_completo: formData.nombre_completo?.trim(),
        grado: formData.grado?.trim(),
        seccion: formData.seccion?.trim().toUpperCase(),
        nombre_representante: formData.nombre_representante?.trim(),
        correo_representante: formData.correo_representante?.trim(),
        qr_code: qrCode
      };

      if (editingStudent) {
        // Actualizar
        const { error } = await supabase
          .from("estudiantes")
          .update(studentData)
          .eq("id", editingStudent.id);
        if (error) throw error;
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from("estudiantes")
          .insert([studentData]);
        if (error) throw error;
      }

      await fetchEstudiantes();
      handleCloseModal();
    } catch (error) {
      console.error("Error al guardar estudiante:", error);
      alert("Error al guardar los datos del estudiante.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEstudiantes = estudiantes.filter(e => 
    e.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cedula.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.grado.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.seccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.correo_representante && e.correo_representante.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredEstudiantes.length / itemsPerPage);
  const currentEstudiantes = filteredEstudiantes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredEstudiantes.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents([...filteredEstudiantes]);
    }
  };

  const toggleStudent = (student: Estudiante) => {
    if (selectedStudents.some(s => s.id === student.id)) {
      setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
    } else {
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  if (showPrintView && selectedStudents.length > 0) {
    return <CarnetsView students={selectedStudents} onClose={() => setShowPrintView(false)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Estudiantes</h1>
          <p className="text-slate-400 mt-1 text-sm">Gestiona alumnos, códigos QR y correos de notificación.</p>
        </div>
        <div className="flex flex-wrap w-full sm:w-auto gap-3">
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

      <div className="glass-panel p-4 sm:p-6 rounded-2xl">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cédula, nombre, correo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.length > 0 && selectedStudents.length === filteredEstudiantes.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                </th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Grado</th>
                <th className="px-4 py-3">Sección</th>
                <th className="px-4 py-3 hidden md:table-cell">Correo Representante</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  </td>
                </tr>
              ) : currentEstudiantes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 italic">
                    No se encontraron estudiantes
                  </td>
                </tr>
              ) : (
                currentEstudiantes.map((estudiante) => (
                  <tr key={estudiante.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedStudents.some(s => s.id === estudiante.id)}
                        onChange={() => toggleStudent(estudiante)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{estudiante.cedula}</td>
                    <td className="px-4 py-3">{estudiante.nombre_completo}</td>
                    <td className="px-4 py-3">{estudiante.grado}</td>
                    <td className="px-4 py-3">{estudiante.seccion}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400">{estudiante.correo_representante || "-"}</td>
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

        {/* Paginación */}
        {!loading && filteredEstudiantes.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
            <div>
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredEstudiantes.length)} de {filteredEstudiantes.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 bg-white/5 rounded-lg font-medium text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Añadir/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">
                {editingStudent ? "Editar Alumno" : "Añadir Nuevo Alumno"}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors">
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
                  onChange={e => setFormData({...formData, cedula: e.target.value})}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Ej: V-12345678"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nombre Completo</label>
                <input
                  required
                  type="text"
                  value={formData.nombre_completo || ""}
                  onChange={e => setFormData({...formData, nombre_completo: e.target.value})}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Nombres y Apellidos"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Grado/Año</label>
                  <input
                    required
                    type="text"
                    value={formData.grado || ""}
                    onChange={e => setFormData({...formData, grado: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ej: 1er Año"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Sección</label>
                  <input
                    required
                    type="text"
                    value={formData.seccion || ""}
                    onChange={e => setFormData({...formData, seccion: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Ej: A"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nombre del Representante</label>
                  <input
                    required
                    type="text"
                    value={formData.nombre_representante || ""}
                    onChange={e => setFormData({...formData, nombre_representante: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Nombre y Apellido"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Correo del Representante</label>
                  <input
                    required
                    type="email"
                    value={formData.correo_representante || ""}
                    onChange={e => setFormData({...formData, correo_representante: e.target.value})}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              
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
    </div>
  );
}

// ── Carnets Print Sub-View ──
function CarnetsView({ students, onClose }: { students: Estudiante[]; onClose: () => void }) {
  const [QRComponent, setQRComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import("qrcode.react").then((mod) => {
      setQRComponent(() => mod.QRCodeSVG);
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
              <h3 className="font-bold text-base sm:text-lg text-blue-950 uppercase leading-tight">{est.nombre_completo}</h3>
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
