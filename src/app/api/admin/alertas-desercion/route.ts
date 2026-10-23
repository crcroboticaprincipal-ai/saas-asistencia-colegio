import { NextResponse } from 'next/server';
import { startOfMonth, format, subDays, getDay, parseISO } from 'date-fns';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const requestedInst = searchParams.get('institucion_id');

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    const sb = getSupabaseAdmin();

    let estQuery = sb
      .from('estudiantes')
      .select('id, nombre_completo, grado, seccion, nombre_representante, correo_representante, estado')
      .eq('estado', 'Activo');

    if (institucionId) {
      estQuery = estQuery.eq('institucion_id', institucionId);
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

    let queryMes = sb
      .from('asistencias')
      .select('estudiante_id, fecha, tipo')
      .eq('tipo', 'ENTRADA')
      .gte('fecha', inicioMesStr)
      .lte('fecha', hoyStr);

    if (institucionId) {
      queryMes = queryMes.eq('institucion_id', institucionId);
    }

    const { data: asistenciasMes, error: asigMesErr } = await queryMes;
    if (asigMesErr) throw new Error(asigMesErr.message);

    let query3Semanas = sb
      .from('asistencias')
      .select('estudiante_id, fecha, tipo')
      .eq('tipo', 'ENTRADA')
      .gte('fecha', inicio3SemanasStr)
      .lte('fecha', hoyStr);

    if (institucionId) {
      query3Semanas = query3Semanas.eq('institucion_id', institucionId);
    }

    const { data: asistencias3Semanas, error: asig3SErr } = await query3Semanas;
    if (asig3SErr) throw new Error(asig3SErr.message);

    const diasConClaseMesSet = new Set<string>();
    (asistenciasMes || []).forEach((a) => diasConClaseMesSet.add(a.fecha));
    const totalDiasClaseMes = diasConClaseMesSet.size;

    const diasConClase3SemanasSet = new Set<string>();
    (asistencias3Semanas || []).forEach((a) => diasConClase3SemanasSet.add(a.fecha));

    const diasClasePorSemanaDia: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    diasConClase3SemanasSet.forEach((fechaStr) => {
      const date = parseISO(fechaStr);
      const dayOfWeek = getDay(date);
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        diasClasePorSemanaDia[dayOfWeek].push(fechaStr);
      }
    });

    const nombresDias: Record<number, string> = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
    };

    const asistenciaEstudianteMes: Record<string, Set<string>> = {};
    (asistenciasMes || []).forEach((a) => {
      if (!asistenciaEstudianteMes[a.estudiante_id]) {
        asistenciaEstudianteMes[a.estudiante_id] = new Set();
      }
      asistenciaEstudianteMes[a.estudiante_id].add(a.fecha);
    });

    const asistenciaEstudiante3Semanas: Record<string, Set<string>> = {};
    (asistencias3Semanas || []).forEach((a) => {
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

    estudiantes.forEach((est) => {
      const presentesMes = asistenciaEstudianteMes[est.id]?.size || 0;
      const rate = totalDiasClaseMes > 0 ? (presentesMes / totalDiasClaseMes) * 100 : 100;
      const inasistenciaRate = 100 - rate;

      let enRiesgo = false;
      const motivos: string[] = [];

      if (totalDiasClaseMes >= 3 && rate < 85) {
        enRiesgo = true;
        motivos.push(`Asistencia inferior al 85% (${rate.toFixed(0)}%)`);
      }

      const presentes3Semanas = asistenciaEstudiante3Semanas[est.id] || new Set<string>();

      for (let dayNum = 1; dayNum <= 5; dayNum++) {
        const fechasClase = diasClasePorSemanaDia[dayNum];
        if (fechasClase && fechasClase.length >= 3) {
          const asistioAlguna = fechasClase.some((fecha) => presentes3Semanas.has(fecha));
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
          correo_representante: est.correo_representante || 'No registrado',
        });
      }
    });

    return NextResponse.json({ ok: true, alertas });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al procesar alertas de deserción' },
      { status: 500 },
    );
  }
}
