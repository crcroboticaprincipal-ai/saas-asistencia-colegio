import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const personal_id = searchParams.get('personal_id');
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');
    const nombre = searchParams.get('nombre') || 'Empleado';

    if (!personal_id || !inicio || !fin) {
      return NextResponse.json({ error: 'Parámetros requeridos: personal_id, inicio, fin' }, { status: 400 });
    }

    const sb = getAdmin();

    // Fetch attendance data for the period
    const { data: asistencias, error } = await sb
      .from('asistencia_personal')
      .select('*')
      .eq('personal_id', personal_id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (error) throw new Error(error.message);

    // Build attendance index by date
    const idx: Record<string, { entrada?: { hora: string; estado: string; minutos?: number | null }; salida?: { hora: string } }> = {};
    (asistencias ?? []).forEach((a: { tipo: string; fecha: string; hora: string; estado_evaluacion: string; minutos_diferencia: number | null }) => {
      if (!idx[a.fecha]) idx[a.fecha] = {};
      if (a.tipo === 'ENTRADA') idx[a.fecha].entrada = { hora: a.hora, estado: a.estado_evaluacion, minutos: a.minutos_diferencia };
      if (a.tipo === 'SALIDA') idx[a.fecha].salida = { hora: a.hora };
    });

    // Parse month
    const mesDate = parseISO(inicio);
    const diasDelMes = eachDayOfInterval({ start: startOfMonth(mesDate), end: endOfMonth(mesDate) });
    const mesLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
      .format(mesDate)
      .replace(/^(\w)/, (c) => c.toUpperCase());

    // Create workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Asisto SaaS';
    wb.created = new Date();

    const ws = wb.addWorksheet(`Asistencia ${mesLabel}`);

    // ── Title rows ──
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Reporte de Asistencia — ${nombre}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:H2');
    const subTitleCell = ws.getCell('A2');
    subTitleCell.value = mesLabel.toUpperCase();
    subTitleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FF94A3B8' } };
    subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // ── Day of week headers (row 3) ──
    const diaSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const headerRow = ws.getRow(3);
    diaSemana.forEach((d, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = d;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF3730A3' } } };
    });
    headerRow.height = 22;

    // Set column widths
    for (let col = 1; col <= 7; col++) {
      ws.getColumn(col).width = 16;
    }

    // ── Build calendar grid ──
    // First day offset (Mon=0 ... Sun=6)
    const firstDay = getDay(startOfMonth(mesDate)); // 0=Sun, 1=Mon...
    const offsetDias = firstDay === 0 ? 6 : firstDay - 1;

    let currentRow = 4;
    let currentCol = offsetDias + 1; // 1-indexed

    diasDelMes.forEach((dia) => {
      if (currentCol > 7) {
        currentCol = 1;
        currentRow++;
      }

      const dateKey = format(dia, 'yyyy-MM-dd');
      const registro = idx[dateKey];
      const esFinde = [0, 6].includes(getDay(dia));
      const cell = ws.getCell(currentRow, currentCol);

      const dayNum = format(dia, 'd');
      const lines: string[] = [`${dayNum}`];

      let fillColor = 'FF1E293B'; // default dark — sin registro
      let fontColor = 'FF64748B';

      if (esFinde) {
        fillColor = 'FF0F172A'; // darker for weekend
        fontColor = 'FF475569';
      }

      if (registro?.entrada) {
        const { hora, estado, minutos } = registro.entrada;
        lines.push(`▲ ${hora.slice(0, 5)}`);
        if (registro.salida) lines.push(`▼ ${registro.salida.hora.slice(0, 5)}`);
        if (estado === 'Retardo' && minutos) lines.push(`+${minutos}m tarde`);

        if (estado === 'Puntual') {
          fillColor = 'FF052E16'; // deep green
          fontColor = 'FF86EFAC'; // light green text
        } else if (estado === 'Retardo') {
          fillColor = 'FF450A0A'; // deep red
          fontColor = 'FFFCA5A5'; // light red text
        } else {
          fillColor = 'FF422006'; // amber
          fontColor = 'FFFCD34D';
        }
      }

      cell.value = lines.join('\n');
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.font = { name: 'Calibri', size: 9, color: { argb: fontColor } };
      cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E293B' } },
        left: { style: 'thin', color: { argb: 'FF1E293B' } },
        bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
        right: { style: 'thin', color: { argb: 'FF1E293B' } },
      };

      ws.getRow(currentRow).height = 52;
      currentCol++;
    });

    // ── Summary stats row ──
    currentRow += 2;
    ws.mergeCells(`A${currentRow}:H${currentRow}`);
    const statsHeader = ws.getCell(`A${currentRow}`);
    statsHeader.value = 'RESUMEN DEL MES';
    statsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    statsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    statsHeader.alignment = { horizontal: 'center' };

    const entradas = (asistencias ?? []).filter((a: { tipo: string }) => a.tipo === 'ENTRADA');
    const puntuales = entradas.filter((a: { estado_evaluacion: string }) => a.estado_evaluacion === 'Puntual').length;
    const retardos = entradas.filter((a: { estado_evaluacion: string }) => a.estado_evaluacion === 'Retardo').length;
    const puntualidad = entradas.length > 0 ? Math.round((puntuales / entradas.length) * 100) : 0;

    currentRow++;
    const statsData = [
      ['Días con Registro', entradas.length],
      ['Puntuales', puntuales],
      ['Retardos', retardos],
      ['% Puntualidad', `${puntualidad}%`],
    ];
    statsData.forEach(([label, val]) => {
      const row = ws.addRow([label, val]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF94A3B8' }, name: 'Calibri', size: 10 };
      row.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
    });

    // ── Legend ──
    ws.addRow([]);
    const legendRow = ws.addRow(['Leyenda:']);
    legendRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.addRow(['Verde = Puntual | Rojo = Retardo | Ámbar = Sin Evaluar | Oscuro = Sin Registro / Día Libre']);
    ws.lastRow!.getCell(1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
    ws.mergeCells(`A${ws.rowCount}:H${ws.rowCount}`);

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Reporte_${nombre.replace(/ /g, '_')}_${format(mesDate, 'yyyy-MM')}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (err: unknown) {
    console.error('Error exportando calendario:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
