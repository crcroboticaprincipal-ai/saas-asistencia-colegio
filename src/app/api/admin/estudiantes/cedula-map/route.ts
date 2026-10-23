import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const requestedInst = searchParams.get('institucion_id');

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    let query = sb
      .from('estudiantes')
      .select('id, cedula, institucion_id')
      .eq('estado', 'Activo');

    if (institucionId) {
      query = query.eq('institucion_id', institucionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const cedulaMap: Record<string, { id: string; institucion_id: string; cedula: string }> = {};
    for (const row of (data ?? []) as { id: string; cedula: string; institucion_id: string }[]) {
      const normalized = row.cedula.replace(/[^0-9]/g, '');
      if (normalized) {
        cedulaMap[normalized] = { id: row.id, institucion_id: row.institucion_id, cedula: row.cedula };
      }
    }

    return NextResponse.json({ ok: true, map: cedulaMap, total: Object.keys(cedulaMap).length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener mapa de cédulas' },
      { status: 500 },
    );
  }
}
