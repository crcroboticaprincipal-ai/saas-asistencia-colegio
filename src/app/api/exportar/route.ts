import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireSession } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireSession(req, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { data, horaOficialEntrada } = body;

    if (!Array.isArray(data) || !horaOficialEntrada) {
      return NextResponse.json({ error: 'Datos no válidos para exportación' }, { status: 400 });
    }

    const [oficialH, oficialM] = String(horaOficialEntrada).split(':').map(Number);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Asisto SaaS';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Resumen Institucional');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metrica', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];

    summarySheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let totalEntradas = 0;
    let minutosTotalesRetardo = 0;
    const usuariosRojo: Set<string> = new Set();
    const retardosPorUsuario: Record<string, number> = {};

    const detailSheet = workbook.addWorksheet('Registro Detallado');
    detailSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Nombre Completo', key: 'nombre', width: 35 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Grado y Sección', key: 'grado', width: 20 },
      { header: 'Hora Entrada', key: 'hora_entrada', width: 15 },
      { header: 'Hora Salida', key: 'hora_salida', width: 15 },
      { header: 'Minutos de Retardo', key: 'retardo', width: 20 },
    ];

    detailSheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    interface ExportRow {
      estudiante_id: string;
      fecha: string;
      tipo: string;
      hora: string;
      estudiantes?: {
        nombre_completo?: string;
        cedula?: string;
        grado?: string;
        seccion?: string;
      };
    }

    interface AgrupadoItem {
      fecha: string;
      nombre: string;
      cedula: string;
      grado: string;
      hora_entrada: string;
      hora_salida: string;
      retardo: number;
    }

    const agrupado: Record<string, AgrupadoItem> = {};

    (data as ExportRow[]).forEach((row) => {
      const key = `${row.estudiante_id}_${row.fecha}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          fecha: row.fecha,
          nombre: row.estudiantes?.nombre_completo || 'Desconocido',
          cedula: row.estudiantes?.cedula || 'N/A',
          grado: `${row.estudiantes?.grado || ''} "${row.estudiantes?.seccion || ''}"`,
          hora_entrada: '-',
          hora_salida: '-',
          retardo: 0,
        };
      }

      if (row.tipo === 'ENTRADA') {
        totalEntradas++;
        agrupado[key].hora_entrada = row.hora;
        const [h, m] = row.hora.split(':').map(Number);
        const entryMinutes = h * 60 + m;
        const officialMinutes = oficialH * 60 + oficialM;

        let retardo = entryMinutes - officialMinutes;
        if (retardo < 0) retardo = 0;

        agrupado[key].retardo = retardo;
        minutosTotalesRetardo += retardo;

        const nombreKey = row.estudiantes?.nombre_completo || 'Desconocido';
        retardosPorUsuario[nombreKey] = (retardosPorUsuario[nombreKey] || 0) + retardo;
      } else if (row.tipo === 'SALIDA') {
        agrupado[key].hora_salida = row.hora;
      }
    });

    Object.values(agrupado).forEach((item) => {
      const row = detailSheet.addRow(item);
      if (item.retardo > 0) {
        const cell = row.getCell(7);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
        cell.font = { color: { argb: 'FFB71C1C' }, bold: true };
      }
    });

    Object.entries(retardosPorUsuario).forEach(([nombre, retardo]) => {
      if (retardo > 0) {
        usuariosRojo.add(`${nombre} (${retardo} mins)`);
      }
    });

    summarySheet.addRow({ metrica: 'Total de Asistencias (Entradas)', valor: totalEntradas });
    summarySheet.addRow({ metrica: 'Minutos Totales de Retardo', valor: minutosTotalesRetardo });
    summarySheet.addRow({ metrica: 'Alumnos con Retardos (Semáforo Rojo)', valor: usuariosRojo.size });
    summarySheet.addRow({ metrica: '', valor: '' });
    summarySheet.addRow({ metrica: 'Detalle Semáforo Rojo', valor: '' });
    summarySheet.getRow(summarySheet.rowCount).font = { bold: true };

    Array.from(usuariosRojo).forEach((u) => {
      summarySheet.addRow({ metrica: u, valor: 'En Rojo' });
      summarySheet.getRow(summarySheet.rowCount).getCell(2).font = { color: { argb: 'FFEF4444' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Asisto_Reporte_${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error generando Excel:', error);
    return NextResponse.json({ error: 'Error interno al generar el archivo Excel' }, { status: 500 });
  }
}
