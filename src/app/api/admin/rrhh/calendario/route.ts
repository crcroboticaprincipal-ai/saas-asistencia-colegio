import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const personal_id = searchParams.get('personal_id');
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');
    const requestedInst = searchParams.get('institucion_id');

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    const sb = getSupabaseAdmin();

    if (!personal_id) {
      let personalQuery = sb
        .from('personal')
        .select('id, nombres, apellidos, rol, cargo, activo, institucion_id')
        .order('apellidos');

      if (institucionId) {
        personalQuery = personalQuery.eq('institucion_id', institucionId);
      }

      const { data, error } = await personalQuery;
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, data: data ?? [] });
    }

    if (!inicio || !fin) {
      return NextResponse.json({ error: 'inicio y fin son requeridos' }, { status: 400 });
    }

    let query = sb
      .from('asistencia_personal')
      .select('id, personal_id, tipo, fecha, hora, estado_evaluacion, minutos_diferencia, institucion_id')
      .eq('personal_id', personal_id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (institucionId) {
      query = query.eq('institucion_id', institucionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
