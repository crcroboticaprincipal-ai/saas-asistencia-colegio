import { NextResponse } from 'next/server';
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

    const now = new Date();
    const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let query = sb
      .from('asistencias')
      .select(`
        estudiante_id,
        estudiantes (nombre_completo, grado, seccion)
      `)
      .gte('fecha', firstDayStr);

    if (institucionId) {
      query = query.eq('institucion_id', institucionId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const grouped: Record<string, {
      nombre_completo: string;
      grado: string;
      seccion: string;
      count: number;
      id: string;
    }> = {};

    for (const row of (data ?? [])) {
      const key = row.estudiante_id;
      const estRaw = row.estudiantes;
      const est = Array.isArray(estRaw) ? estRaw[0] : estRaw;
      if (!key || !est) continue;

      if (!grouped[key]) {
        grouped[key] = {
          nombre_completo: est.nombre_completo,
          grado: est.grado,
          seccion: est.seccion,
          count: 0,
          id: key,
        };
      }
      grouped[key].count += 1;
    }

    const sorted = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({ ok: true, data: sorted });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener semáforo' },
      { status: 500 },
    );
  }
}
