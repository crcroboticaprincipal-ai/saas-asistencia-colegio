import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, resolveInstitucion } from '@/lib/api-auth';
import { sanitizeSearch } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const grado = sanitizeSearch(searchParams.get('grado') ?? '');
    const seccion = sanitizeSearch(searchParams.get('seccion') ?? '').toUpperCase();
    const requestedInst = searchParams.get('institucion_id');

    if (!grado || !seccion) {
      return NextResponse.json({ error: 'grado y seccion son requeridos' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    let estQuery = sb
      .from('estudiantes')
      .select('id, nombre_completo, cedula, foto_url, grado, seccion, institucion_id, qr_code')
      .eq('grado', grado)
      .eq('seccion', seccion)
      .eq('estado', 'Activo')
      .order('nombre_completo');

    if (institucionId) {
      estQuery = estQuery.eq('institucion_id', institucionId);
    }

    const { data: estudiantes, error: estErr } = await estQuery;
    if (estErr) throw new Error(estErr.message);

    const studentIds = (estudiantes ?? []).map((e: { id: string }) => e.id);

    const todayStr = new Date().toISOString().slice(0, 10);
    const porteriaMap: Record<string, string> = {};

    if (studentIds.length > 0) {
      const { data: registros } = await sb
        .from('registros_asistencia')
        .select('estudiante_id, hora_entrada')
        .in('estudiante_id', studentIds)
        .eq('fecha', todayStr)
        .not('hora_entrada', 'is', null);

      if (registros) {
        for (const r of registros as { estudiante_id: string; hora_entrada: string }[]) {
          porteriaMap[r.estudiante_id] = r.hora_entrada;
        }
      }
    }

    const { data: asistenciaHoy } = await sb
      .from('asistencia_materia')
      .select('estudiante_id, estado')
      .in('estudiante_id', studentIds)
      .eq('fecha', todayStr);

    const asistenciaMap: Record<string, string> = {};
    if (asistenciaHoy) {
      for (const a of asistenciaHoy as { estudiante_id: string; estado: string }[]) {
        asistenciaMap[a.estudiante_id] = a.estado;
      }
    }

    const result = (estudiantes ?? []).map((est: {
      id: string;
      nombre_completo: string;
      cedula: string;
      foto_url: string | null;
      grado: string;
      seccion: string;
      institucion_id: string;
      qr_code: string;
    }) => ({
      ...est,
      hora_entrada_porteria: porteriaMap[est.id] ?? null,
      asistencia_aula_hoy: asistenciaMap[est.id] ?? null,
    }));

    return NextResponse.json({ ok: true, data: result, total: result.length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener estudiantes' },
      { status: 500 },
    );
  }
}
