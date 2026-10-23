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
      .from('personal')
      .select('id, nombres, apellidos, cedula, correo, telefono, cargo, rol, username, activo, auth_user_id, institucion_id, created_at')
      .order('apellidos', { ascending: true });

    if (institucionId) {
      query = query.eq('institucion_id', institucionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
