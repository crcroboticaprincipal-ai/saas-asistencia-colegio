"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Search, Download, Calendar, Filter, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";

type Asistencia = {
  id: string;
  estudiante_id: string;
  tipo: "ENTRADA" | "SALIDA";
  fecha: string;
  hora: string;
  estudiantes: {
    cedula: string;
    nombre_completo: string;
    grado: string;
    seccion: string;
  };
};

export default function ReportesComponent() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [filteredData, setFilteredData] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTiempo, setFiltroTiempo] = useState("TODOS");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let result = asistencias;

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.estudiantes?.nombre_completo?.toLowerCase().includes(s) ||
          a.estudiantes?.cedula?.includes(s)
      );
    }

    // Time filter
    const today = new Date();
    if (filtroTiempo === "HOY") {
      const todayStr = today.toISOString().split("T")[0];
      result = result.filter((a) => a.fecha === todayStr);
    } else if (filtroTiempo === "SEMANA") {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      result = result.filter((a) => a.fecha >= weekAgo);
    } else if (filtroTiempo === "MES") {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      result = result.filter((a) => a.fecha >= monthAgo);
    }

    setFilteredData(result);
  }, [search, filtroTiempo, asistencias]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asistencias")
        .select(
          `
          id,
          estudiante_id,
          tipo,
          fecha,
          hora,
          estudiantes (
            cedula,
            nombre_completo,
            grado,
            seccion
          )
        `
        )
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (error) throw error;
      setAsistencias(data as unknown as Asistencia[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = useCallback(async () => {
    const XLSX = await import("xlsx");
    const dataToExport = filteredData.map((a) => ({
      Fecha: a.fecha,
      Hora: a.hora,
      Cédula: a.estudiantes?.cedula,
      Nombre: a.estudiantes?.nombre_completo,
      Grado: a.estudiantes?.grado,
      Sección: a.estudiantes?.seccion,
      Tipo: a.tipo,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Asistencia");
    XLSX.writeFile(wb, `Reporte_Asistencia_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredData]);

  const exportToPDF = useCallback(async () => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte de Asistencia", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("UE Colegio Rafael Castillo", 14, 22);

    const tableData = filteredData.map((a) => [
      a.fecha,
      a.hora,
      a.estudiantes?.cedula || "",
      a.estudiantes?.nombre_completo || "",
      `${a.estudiantes?.grado || ""} "${a.estudiantes?.seccion || ""}"`,
      a.tipo,
    ]);

    autoTable(doc, {
      head: [["Fecha", "Hora", "Cédula", "Nombre", "Grado/Sección", "Tipo"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`Reporte_Asistencia_${new Date().toISOString().split("T")[0]}.pdf`);
  }, [filteredData]);

  // Stats
  const entradas = filteredData.filter((a) => a.tipo === "ENTRADA").length;
  const salidas = filteredData.filter((a) => a.tipo === "SALIDA").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reportes y Analítica</h1>
          <p className="text-slate-400 mt-1">Exportación y búsqueda histórica de asistencias.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="px-3 py-2 bg-white/5 text-slate-300 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportToExcel}
            disabled={filteredData.length === 0}
            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors flex items-center gap-2 font-medium disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={filteredData.length === 0}
            className="px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl hover:bg-rose-500/30 transition-colors flex items-center gap-2 font-medium disabled:opacity-40"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{filteredData.length}</p>
        </div>
        <div className="glass-card p-4 rounded-xl text-center">
          <p className="text-xs text-emerald-400 uppercase tracking-wide">Entradas</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{entradas}</p>
        </div>
        <div className="glass-card p-4 rounded-xl text-center">
          <p className="text-xs text-rose-400 uppercase tracking-wide">Salidas</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{salidas}</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filtroTiempo}
              onChange={(e) => setFiltroTiempo(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-8 text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="TODOS">Histórico Completo</option>
              <option value="HOY">Hoy</option>
              <option value="SEMANA">Últimos 7 días</option>
              <option value="MES">Últimos 30 días</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
              <tr>
                <th className="px-6 py-4">Fecha / Hora</th>
                <th className="px-6 py-4">Estudiante</th>
                <th className="px-6 py-4">Cédula</th>
                <th className="px-6 py-4">Grado</th>
                <th className="px-6 py-4 text-right">Registro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      <span className="text-slate-500">Cargando datos…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron registros para estos filtros.
                  </td>
                </tr>
              ) : (
                filteredData.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="font-medium text-slate-200">{a.fecha}</span>
                        <span className="text-slate-500">{a.hora}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{a.estudiantes?.nombre_completo}</td>
                    <td className="px-6 py-4">{a.estudiantes?.cedula}</td>
                    <td className="px-6 py-4">
                      {a.estudiantes?.grado} &ldquo;{a.estudiantes?.seccion}&rdquo;
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                          a.tipo === "ENTRADA"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {a.tipo}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-slate-500 text-right">Mostrando {filteredData.length} registros</div>
      </div>
    </div>
  );
}
