"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { Download, Calendar, Users, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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
  
  // Filtros
  const [filtroTiempo, setFiltroTiempo] = useState("HOY");
  const [organizacion, setOrganizacion] = useState("Colegio Rafael Castillo");
  const [horaOficialEntrada, setHoraOficialEntrada] = useState("07:00");
  
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("asistencias")
      .select(`
        id,
        estudiante_id,
        tipo,
        fecha,
        hora,
        estudiantes (cedula, nombre_completo, grado, seccion)
      `)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false });

    if (data && !error) {
      setAsistencias(data as unknown as Asistencia[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    let result = asistencias;
    const today = new Date();
    
    // Obtener string en formato local de Caracas YYYY-MM-DD
    const getCaracasDateString = (date: Date) => {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    };

    const todayStr = getCaracasDateString(today);

    if (filtroTiempo === "HOY") {
      result = result.filter((a) => a.fecha === todayStr);
    } else if (filtroTiempo === "SEMANA") {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = getCaracasDateString(weekAgo);
      result = result.filter((a) => a.fecha >= weekAgoStr);
    } else if (filtroTiempo === "MES") {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const monthAgoStr = getCaracasDateString(monthAgo);
      result = result.filter((a) => a.fecha >= monthAgoStr);
    }

    setFilteredData(result);
  }, [filtroTiempo, asistencias]);

  // KPIs y Cálculos
  const { totalEntradas, minutosRetardoTotales, promedioHoraLlegada, chartData } = useMemo(() => {
    let entradas = 0;
    let retardosAcumulados = 0;
    let totalMinutosLlegada = 0;
    
    const [oficialH, oficialM] = horaOficialEntrada.split(":").map(Number);
    const officialMinutes = oficialH * 60 + oficialM;

    // Para el gráfico: agrupar por fecha
    const entradasPorDia: Record<string, number> = {};

    filteredData.forEach(a => {
      if (a.tipo === "ENTRADA") {
        entradas++;
        
        // Sumar para el gráfico
        entradasPorDia[a.fecha] = (entradasPorDia[a.fecha] || 0) + 1;

        const [h, m] = a.hora.split(":").map(Number);
        const entryMinutes = h * 60 + m;
        totalMinutosLlegada += entryMinutes;

        let retardo = entryMinutes - officialMinutes;
        if (retardo > 0) {
          retardosAcumulados += retardo;
        }
      }
    });

    // Formatear promedio
    let promedioStr = "--:--";
    if (entradas > 0) {
      const promMinutos = Math.floor(totalMinutosLlegada / entradas);
      const h = Math.floor(promMinutos / 60);
      const m = promMinutos % 60;
      promedioStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // Preparar Data del Gráfico (ordenar por fecha)
    const sortedDates = Object.keys(entradasPorDia).sort();
    const chart = sortedDates.map(date => {
      // Formato DD/MM
      const [y, m, d] = date.split("-");
      return {
        name: `${d}/${m}`,
        Entradas: entradasPorDia[date]
      };
    });

    return {
      totalEntradas: entradas,
      minutosRetardoTotales: retardosAcumulados,
      promedioHoraLlegada: promedioStr,
      chartData: chart
    };
  }, [filteredData, horaOficialEntrada]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          data: filteredData, 
          horaOficialEntrada 
        })
      });

      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Qrono_Reporte_${filtroTiempo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      alert("Error al descargar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-indigo-500" />
            Qrono Analytics
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Inteligencia y reportes dinámicos de asistencia.</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={isExporting || filteredData.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {isExporting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? "Generando Excel Inteligente..." : "Exportar a Excel"}
        </button>
      </div>

      {/* Selectores */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Organización (Multi-tenant)</label>
          <select 
            value={organizacion} 
            onChange={(e) => setOrganizacion(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
          >
            <option value="Colegio Rafael Castillo">Colegio Rafael Castillo</option>
            <option value="Otra Sede">Sede Secundaria (Demo)</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Rango de Tiempo</label>
          <select 
            value={filtroTiempo} 
            onChange={(e) => setFiltroTiempo(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
          >
            <option value="HOY">Hoy</option>
            <option value="SEMANA">Esta Semana</option>
            <option value="MES">Últimos 30 Días</option>
            <option value="TODOS">Histórico Completo</option>
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Hora Oficial Entrada</label>
          <input 
            type="time"
            value={horaOficialEntrada}
            onChange={(e) => setHoraOficialEntrada(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm [color-scheme:dark]"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-emerald-500" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Total Entradas</p>
          <h3 className="text-3xl font-bold text-white">{loading ? "-" : totalEntradas}</h3>
          <p className="text-emerald-400 text-xs mt-2 font-medium">Asistencias registradas</p>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Promedio Hora Llegada</p>
          <h3 className="text-3xl font-bold text-white">{loading ? "-" : promedioHoraLlegada}</h3>
          <p className="text-blue-400 text-xs mt-2 font-medium">Tiempo medio de ingreso</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-16 h-16 text-rose-500" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Retardos Acumulados</p>
          <h3 className="text-3xl font-bold text-white">{loading ? "-" : minutosRetardoTotales}</h3>
          <p className="text-rose-400 text-xs mt-2 font-medium">Minutos totales después de las {horaOficialEntrada}</p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-6">Tendencia de Ingresos</h2>
        <div className="h-[300px] w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              No hay suficientes datos para graficar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff10', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                />
                <Bar dataKey="Entradas" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
