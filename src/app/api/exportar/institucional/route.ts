import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo, fechaInicio, fechaFin, data } = body;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Qrono Platform";
    wb.lastModifiedBy = "Qrono";
    wb.created = new Date();
    wb.modified = new Date();

    // ── ESTILOS BASE ──
    const hdrFill: ExcelJS.Fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo Eléctrico
    };
    const hdrFont: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true, size: 11, name: "Calibri" };
    const bodyFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
    const greenFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    const redFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    const amber: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    const addHeader = (ws: ExcelJS.Worksheet, titulo: string) => {
      // Fila de título Qrono
      ws.mergeCells("A1:F1");
      const titleCell = ws.getCell("A1");
      titleCell.value = `QRONO — ${titulo}`;
      titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF4F46E5" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 28;

      // Fila de institución + período
      ws.mergeCells("A2:F2");
      const subCell = ws.getCell("A2");
      subCell.value = `Colegio Rafael Castillo · Período: ${fechaInicio} al ${fechaFin}`;
      subCell.font = { name: "Calibri", size: 10, color: { argb: "FF64748B" } };
      subCell.alignment = { horizontal: "center" };
      ws.getRow(2).height = 18;

      // Fila de generación
      ws.mergeCells("A3:F3");
      const genCell = ws.getCell("A3");
      genCell.value = `Generado: ${format(new Date(), "PPPp", { locale: es })}`;
      genCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } };
      genCell.alignment = { horizontal: "center" };
      ws.getRow(3).height = 14;

      ws.addRow([]); // separador
    };

    // ── HOJA: ANALÍTICA DE MATERIAS ──
    if (tipo === "materias" && data) {
      const ws = wb.addWorksheet("Analítica por Materia");
      ws.properties.defaultRowHeight = 18;

      addHeader(ws, "ANALÍTICA POR MATERIA");

      // Cabeceras
      const cabRow = ws.addRow(["Materia", "Grado", "Sección", "Presentes", "Ausentes", "% Asistencia"]);
      cabRow.eachCell((cell) => {
        cell.fill = hdrFill;
        cell.font = hdrFont;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
      });
      ws.getRow(5).height = 22;

      // Columnas
      ws.columns = [
        { key: "nombre", width: 28 },
        { key: "grado", width: 14 },
        { key: "seccion", width: 10 },
        { key: "presentes", width: 12 },
        { key: "ausentes", width: 12 },
        { key: "porcentaje", width: 14 },
      ];

      // Datos
      (data as Record<string, unknown>[]).forEach((d: Record<string, unknown>) => {
        const pct = d.porcentaje as number;
        const row = ws.addRow([d.nombre, d.grado, `"${d.seccion}"`, d.presentes, d.ausentes, `${pct}%`]);
        row.font = bodyFont;

        // Color semáforo en la celda de porcentaje
        const pctCell = row.getCell(6);
        if (pct >= 90) { pctCell.fill = greenFill; pctCell.font = { ...bodyFont, color: { argb: "FF065F46" }, bold: true }; }
        else if (pct >= 70) { pctCell.fill = amber; pctCell.font = { ...bodyFont, color: { argb: "FF92400E" }, bold: true }; }
        else { pctCell.fill = redFill; pctCell.font = { ...bodyFont, color: { argb: "FF7F1D1D" }, bold: true }; }

        // Ausentes en rojo
        if ((d.ausentes as number) > 0) {
          row.getCell(5).font = { ...bodyFont, color: { argb: "FFDC2626" } };
        }

        row.eachCell((cell) => { cell.border = thinBorder; cell.alignment = { vertical: "middle", horizontal: "center" }; });
        row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
      });

      // Fila de totales
      const total = (data as Record<string, unknown>[]).reduce(
        (acc: { presentes: number; ausentes: number }, d: Record<string, unknown>) => ({
          presentes: acc.presentes + (d.presentes as number),
          ausentes: acc.ausentes + (d.ausentes as number),
        }), { presentes: 0, ausentes: 0 }
      );
      const totalRow = ws.addRow(["TOTALES", "", "", total.presentes, total.ausentes, ""]);
      totalRow.eachCell((cell) => {
        cell.font = { ...bodyFont, bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cell.border = thinBorder;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      totalRow.getCell(1).alignment = { horizontal: "left" };
    }

    // ── HOJA: RESUMEN INSTITUCIONAL ──
    {
      const ws = wb.addWorksheet("Resumen Qrono");
      ws.properties.defaultRowHeight = 18;
      ws.getColumn(1).width = 30;
      ws.getColumn(2).width = 25;

      ws.addRow(["QRONO — SISTEMA DE ASISTENCIA ESCOLAR"]).font = {
        name: "Calibri", bold: true, size: 16, color: { argb: "FF4F46E5" }
      };
      ws.addRow(["Colegio Rafael Castillo"]).font = { name: "Calibri", size: 12, color: { argb: "FF334155" } };
      ws.addRow([`Reporte generado: ${format(new Date(), "PPPp", { locale: es })}`]).font = { name: "Calibri", size: 10, color: { argb: "FF94A3B8" } };
      ws.addRow([]);
      ws.addRow(["Plataforma", "Qrono EdTech"]);
      ws.addRow(["Tipo de reporte", tipo === "materias" ? "Analítica por Materia" : "General"]);
      ws.addRow(["Período", `${fechaInicio} al ${fechaFin}`]);
    }

    // Generar buffer y devolver
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Qrono_Reporte_${format(new Date(), "yyyyMMdd")}.xlsx"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error generando Excel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
