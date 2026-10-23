import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { sanitizeSearch } from '@/lib/validation';

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
      .from('materias')
      .select('id, nombre, codigo, nivel, created_at, institucion_id')
      .order('nombre');

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

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const body = await request.json();
    const { nombre, codigo, nivel, institucion_id } = body;

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;

    if (!nombre?.trim() || !targetInstitucionId) {
      return NextResponse.json({ error: 'Nombre e institucion_id son obligatorios' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('materias')
      .insert([
        {
          nombre: sanitizeSearch(nombre),
          codigo: codigo ? sanitizeSearch(codigo) : null,
          nivel: nivel || null,
          institucion_id: targetInstitucionId,
        },
      ])
      .select('id, nombre, codigo, nivel, created_at, institucion_id')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    let deleteQuery = sb.from('materias').delete().eq('id', id);
    if (session.kind === 'admin' && session.rol !== 'superadmin' && session.inst) {
      deleteQuery = deleteQuery.eq('institucion_id', session.inst);
    }

    const { error } = await deleteQuery;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
