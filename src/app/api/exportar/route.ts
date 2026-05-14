import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { parseISO, differenceInMinutes, isValid } from "date-fns";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, horaOficialEntrada } = body;

    // horaOficialEntrada format: "HH:mm" (e.g., "07:00")
    const [oficialH, oficialM] = horaOficialEntrada.split(":").map(Number);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Qrono SaaS";
    workbook.created = new Date();

    // ── HOJA 1: RESUMEN INSTITUCIONAL ──
    const summarySheet = workbook.addWorksheet("Resumen Institucional");
    
    summarySheet.columns = [
      { header: "Métrica", key: "metrica", width: 30 },
      { header: "Valor", key: "valor", width: 20 },
    ];

    // Estilos de Cabecera
    summarySheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    let totalEntradas = 0;
    let minutosTotalesRetardo = 0;
    const usuariosRojo: Set<string> = new Set(); // Usuarios con más de 15 mins de retardo acumulado (ejemplo)
    
    // Diccionario temporal para acumular retardos por usuario
    const retardosPorUsuario: Record<string, number> = {};

    // ── HOJA 2: REGISTRO DETALLADO ──
    const detailSheet = workbook.addWorksheet("Registro Detallado");
    detailSheet.columns = [
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Nombre Completo", key: "nombre", width: 35 },
      { header: "Cédula", key: "cedula", width: 15 },
      { header: "Grado y Sección", key: "grado", width: 20 },
      { header: "Hora Entrada", key: "hora_entrada", width: 15 },
      { header: "Hora Salida", key: "hora_salida", width: 15 },
      { header: "Minutos de Retardo", key: "retardo", width: 20 },
    ];

    detailSheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Agrupar por estudiante y fecha para tener ENTRADA y SALIDA en la misma fila
    const agrupado: Record<string, any> = {};

    data.forEach((row: any) => {
      const key = `${row.estudiante_id}_${row.fecha}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          fecha: row.fecha,
          nombre: row.estudiantes?.nombre_completo || "Desconocido",
          cedula: row.estudiantes?.cedula || "N/A",
          grado: `${row.estudiantes?.grado || ""} "${row.estudiantes?.seccion || ""}"`,
          hora_entrada: "-",
          hora_salida: "-",
          retardo: 0,
        };
      }

      if (row.tipo === "ENTRADA") {
        totalEntradas++;
        agrupado[key].hora_entrada = row.hora;
        
        // Calcular retardo
        // row.hora is "HH:mm:ss"
        const [h, m] = row.hora.split(":").map(Number);
        const entryMinutes = h * 60 + m;
        const officialMinutes = oficialH * 60 + oficialM;
        
        let retardo = entryMinutes - officialMinutes;
        if (retardo < 0) retardo = 0;
        
        agrupado[key].retardo = retardo;
        minutosTotalesRetardo += retardo;

        retardosPorUsuario[row.estudiantes?.nombre_completo] = (retardosPorUsuario[row.estudiantes?.nombre_completo] || 0) + retardo;
      } else if (row.tipo === "SALIDA") {
        agrupado[key].hora_salida = row.hora;
      }
    });

    // Populate Detail Sheet
    Object.values(agrupado).forEach((item) => {
      const row = detailSheet.addRow(item);
      
      // Color condicional para retardo
      if (item.retardo > 0) {
        const cell = row.getCell(7); // Columna "Minutos de Retardo"
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCDD2" } }; // Rojo claro
        cell.font = { color: { argb: "FFB71C1C" }, bold: true };
      }
    });

    // Identificar usuarios en rojo (ej. más de 0 mins de retardo acumulado en el periodo filtrado)
    Object.entries(retardosPorUsuario).forEach(([nombre, retardo]) => {
      if (retardo > 0) {
        usuariosRojo.add(`${nombre} (${retardo} mins)`);
      }
    });

    // Populate Summary Sheet
    summarySheet.addRow({ metrica: "Total de Asistencias (Entradas)", valor: totalEntradas });
    summarySheet.addRow({ metrica: "Minutos Totales de Retardo", valor: minutosTotalesRetardo });
    summarySheet.addRow({ metrica: "Alumnos con Retardos (Semáforo Rojo)", valor: usuariosRojo.size });
    
    summarySheet.addRow({ metrica: "", valor: "" });
    summarySheet.addRow({ metrica: "Detalle Semáforo Rojo", valor: "" });
    summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
    
    Array.from(usuariosRojo).forEach((u) => {
      summarySheet.addRow({ metrica: u, valor: "En Rojo" });
      summarySheet.getRow(summarySheet.rowCount).getCell(2).font = { color: { argb: "FFEF4444" } };
    });

    // Generar Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Retornar archivo
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="Qrono_Reporte_${new Date().toISOString().split("T")[0]}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("Error generating Excel:", error);
    return NextResponse.json({ error: "Error interno al generar el archivo Excel" }, { status: 500 });
  }
}
