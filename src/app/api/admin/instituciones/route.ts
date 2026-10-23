import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, requireSuperadmin, resolveInstitucion } from '@/lib/api-auth';
import { sanitizeSearch } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('instituciones')
      .select('id, nombre, nombre_corto, nivel_educativo, plan_suscripcion, activo, created_at')
      .order('created_at', { ascending: false });

    const instResult = resolveInstitucion(session);
    if (instResult.ok && instResult.institucionId) {
      query = query.eq('id', instResult.institucionId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperadmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { nombre, nombre_corto, nivel_educativo } = await request.json();

    if (!nombre || !nivel_educativo) {
      return NextResponse.json({ error: 'Nombre y nivel educativo son obligatorios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('instituciones')
      .insert([
        {
          nombre: sanitizeSearch(nombre),
          nombre_corto: nombre_corto ? sanitizeSearch(nombre_corto) : null,
          nivel_educativo,
          plan_suscripcion: 'starter',
          activo: true,
        },
      ])
      .select('id, nombre, nombre_corto, nivel_educativo, plan_suscripcion, activo, created_at')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
