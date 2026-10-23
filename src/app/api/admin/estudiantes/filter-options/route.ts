import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
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
      .select('grado, seccion')
      .eq('estado', 'Activo')
      .order('grado');

    if (institucionId) {
      query = query.eq('institucion_id', institucionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const grados = [...new Set((data ?? []).map((r) => r.grado).filter(Boolean))].sort();
    const secciones = [...new Set((data ?? []).map((r) => r.seccion).filter(Boolean))].sort();

    return NextResponse.json({ ok: true, grados, secciones });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener opciones de filtro' },
      { status: 500 },
    );
  }
}
