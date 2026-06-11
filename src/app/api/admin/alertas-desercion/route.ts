import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfMonth, format, subDays, getDay, parseISO } from 'date-fns';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const institucion_id = searchParams.get('institucion_id');

    const sb = getAdmin();
    
    // 1. Fetch active students — always scoped to the calling institution
    let estQuery = sb
      .from('estudiantes')
      .select('id, nombre_completo, grado, seccion, nombre_representante, correo_representante, estado')
      .eq('estado', 'Activo');

    if (institucion_id) {
      estQuery = estQuery.eq('institucion_id', institucion_id);
    }

    const { data: estudiantes, error: estErr } = await estQuery;

    if (estErr) throw new Error(estErr.message);
    if (!estudiantes || estudiantes.length === 0) {
      return NextResponse.json({ ok: true, alertas: [] });
    }

    const hoy = new Date();
    const inicioMes = startOfMonth(hoy);
    const inicioMesStr = format(inicioMes, 'yyyy-MM-dd');
    const hoyStr = format(hoy, 'yyyy-MM-dd');
    
    const inicio3Semanas = subDays(hoy, 21);
    const inicio3SemanasStr = format(inicio3Semanas, 'yyyy-MM-dd');

    // 2. Fetch all ENTRADA attendances for the current month — scoped to institution
    let queryMes = sb
      .from('asistencias')
      .select('estudiante_id, fecha, tipo')
      .eq('tipo', 'ENTRADA')
      .gte('fecha', inicioMesStr)
      .lte('fecha', hoyStr);

    if (institucion_id) {
      queryMes = queryMes.eq('institucion_id', institucion_id);
    }

    const { data: asistenciasMes, error: asigMesErr } = await queryMes;

    if (asigMesErr) throw new Error(asigMesErr.message);

    // 3. Fetch all ENTRADA attendances for the past 3 weeks (21 days) — scoped to institution
    let query3Semanas = sb
      .from('asistencias')
      .select('estudiante_id, fecha, tipo')
      .eq('tipo', 'ENTRADA')
      .gte('fecha', inicio3SemanasStr)
      .lte('fecha', hoyStr);

    if (institucion_id) {
      query3Semanas = query3Semanas.eq('institucion_id', institucion_id);
    }

    const { data: asistencias3Semanas, error: asig3SErr } = await query3Semanas;

    if (asig3SErr) throw new Error(asig3SErr.message);

    // Calculate actual school days in the current month (days where at least one student marked entry)
    const diasConClaseMesSet = new Set<string>();
    (asistenciasMes || []).forEach(a => diasConClaseMesSet.add(a.fecha));
    const totalDiasClaseMes = diasConClaseMesSet.size;

    // Calculate actual school days in the past 21 days, grouped by day of the week (Mon=1, Tue=2, etc.)
    const diasConClase3SemanasSet = new Set<string>();
    (asistencias3Semanas || []).forEach(a => diasConClase3SemanasSet.add(a.fecha));

    const diasClasePorSemanaDia: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    diasConClase3SemanasSet.forEach(fechaStr => {
      const date = parseISO(fechaStr);
      const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        diasClasePorSemanaDia[dayOfWeek].push(fechaStr);
      }
    });

    // Map of weekday numbers to Spanish names
    const nombresDias: Record<number, string> = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes'
    };

    // Index attendances for students
    // For current month: student_id -> set of present dates
    const asistenciaEstudianteMes: Record<string, Set<string>> = {};
    (asistenciasMes || []).forEach(a => {
      if (!asistenciaEstudianteMes[a.estudiante_id]) {
        asistenciaEstudianteMes[a.estudiante_id] = new Set();
      }
      asistenciaEstudianteMes[a.estudiante_id].add(a.fecha);
    });

    // For past 21 days: student_id -> set of present dates
    const asistenciaEstudiante3Semanas: Record<string, Set<string>> = {};
    (asistencias3Semanas || []).forEach(a => {
      if (!asistenciaEstudiante3Semanas[a.estudiante_id]) {
        asistenciaEstudiante3Semanas[a.estudiante_id] = new Set();
      }
      asistenciaEstudiante3Semanas[a.estudiante_id].add(a.fecha);
    });

    type AlertaDesercion = {
      id: string;
      nombre_completo: string;
      grado: string;
      seccion: string;
      porcentaje_inasistencia: number;
      porcentaje_asistencia: number;
      motivo: string;
      nombre_representante: string;
      correo_representante: string;
    };

    const alertas: AlertaDesercion[] = [];

    estudiantes.forEach(est => {
      const presentesMes = asistenciaEstudianteMes[est.id]?.size || 0;
      const rate = totalDiasClaseMes > 0 ? (presentesMes / totalDiasClaseMes) * 100 : 100;
      const inasistenciaRate = 100 - rate;

      let enRiesgo = false;
      let motivos: string[] = [];

      // Condición 1: Tasa de asistencia inferior al 85% en el mes en curso (con al menos 3 días hábiles registrados)
      if (totalDiasClaseMes >= 3 && rate < 85) {
        enRiesgo = true;
        motivos.push(`Asistencia inferior al 85% (${rate.toFixed(0)}%)`);
      }

      // Condición 2: Faltas consecutivas el mismo día de la semana (3 veces consecutivas en las últimas 3 semanas)
      // Para cada día de la semana que tuvo exactamente 3 días de clases registrados en los últimos 21 días,
      // verificar si el estudiante faltó a los 3.
      const presentes3Semanas = asistenciaEstudiante3Semanas[est.id] || new Set<string>();
      
      for (let dayNum = 1; dayNum <= 5; dayNum++) {
        const fechasClase = diasClasePorSemanaDia[dayNum];
        // Si hay al menos 3 días hábiles registrados para este día de la semana
        if (fechasClase && fechasClase.length >= 3) {
          // Verificar si el estudiante no asistió a ninguno de estos días
          const asistioAlguna = fechasClase.some(fecha => presentes3Semanas.has(fecha));
          if (!asistioAlguna) {
            enRiesgo = true;
            motivos.push(`Ausente 3 ${nombresDias[dayNum]}s seguidos`);
          }
        }
      }

      if (enRiesgo) {
        alertas.push({
          id: est.id,
          nombre_completo: est.nombre_completo,
          grado: est.grado,
          seccion: est.seccion,
          porcentaje_inasistencia: Math.round(inasistenciaRate),
          porcentaje_asistencia: Math.round(rate),
          motivo: motivos.join(' y '),
          nombre_representante: est.nombre_representante || 'No registrado',
          correo_representante: est.correo_representante || 'No registrado'
        });
      }
    });

    return NextResponse.json({ ok: true, alertas });
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Error al procesar alertas de deserción'
    }, { status: 500 });
  }
}
