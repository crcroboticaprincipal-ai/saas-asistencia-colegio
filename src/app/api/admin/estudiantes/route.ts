import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import {
  estudianteCreateSchema,
  estudianteUpdateSchema,
  sanitizeSearch,
  firstZodError,
} from '@/lib/validation';

const ESTUDIANTE_SELECT_FIELDS =
  'id, cedula, nombre_completo, grado, seccion, nombre_representante, correo_representante, qr_code, institucion_id, estado, foto_url, alertas_inasistencia, alertas_retardo, created_at, updated_at';

// GET — Lista estudiantes con paginación y aislamiento por institución
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const instResult = resolveInstitucion(auth.session, searchParams.get('institucion_id'));
    if (!instResult.ok) return instResult.response;

    const sb = getSupabaseAdmin();
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const rawSearch = searchParams.get('search') ?? '';
    const search = sanitizeSearch(rawSearch);
    const gradoFilter = searchParams.get('grado')?.trim() ?? '';
    const seccionFilter = searchParams.get('seccion')?.trim() ?? '';
    const from = page * limit;
    const to = from + limit - 1;

    let query = sb
      .from('estudiantes')
      .select(ESTUDIANTE_SELECT_FIELDS, { count: 'exact' })
      .order('nombre_completo');

    if (instResult.institucionId) {
      query = query.eq('institucion_id', instResult.institucionId);
    }

    if (search) {
      query = query.or(
        `nombre_completo.ilike.%${search}%,cedula.ilike.%${search}%,grado.ilike.%${search}%,seccion.ilike.%${search}%`
      );
    }

    if (gradoFilter) {
      query = query.eq('grado', gradoFilter);
    }
    if (seccionFilter) {
      query = query.eq('seccion', seccionFilter.toUpperCase());
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al obtener estudiantes' }, { status: 500 });
  }
}

// POST — Crea un nuevo estudiante
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = estudianteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const payload = parsed.data;
    const instResult = resolveInstitucion(auth.session, payload.institucion_id);
    if (!instResult.ok) return instResult.response;

    const sb = getSupabaseAdmin();
    let finalInstId = instResult.institucionId;

    if (!finalInstId) {
      const { data: inst } = await sb.from('instituciones').select('id').eq('activo', true).limit(1).maybeSingle();
      if (!inst) {
        return NextResponse.json({ error: 'No se encontró una institución activa.' }, { status: 400 });
      }
      finalInstId = inst.id;
    }

    const { data, error } = await sb
      .from('estudiantes')
      .insert([{
        cedula: payload.cedula,
        nombre_completo: payload.nombre_completo,
        grado: payload.grado,
        seccion: payload.seccion,
        nombre_representante: payload.nombre_representante,
        correo_representante: payload.correo_representante,
        qr_code: payload.qr_code,
        institucion_id: finalInstId,
        estado: payload.estado || 'Activo'
      }])
      .select(ESTUDIANTE_SELECT_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear estudiante' }, { status: 500 });
  }
}

// PUT — Actualiza un estudiante existente
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = estudianteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const payload = parsed.data;
    const instResult = resolveInstitucion(auth.session, payload.institucion_id);
    if (!instResult.ok) return instResult.response;

    const sb = getSupabaseAdmin();

    const { id, foto_url, ...updateFields } = body;

    const updateData: Record<string, unknown> = { ...updateFields };
    if (foto_url !== undefined) updateData.foto_url = foto_url;
    if (instResult.institucionId) updateData.institucion_id = instResult.institucionId;

    let query = sb.from('estudiantes').update(updateData).eq('id', payload.id);
    if (instResult.institucionId && !auth.session.inst) {
      query = query.eq('institucion_id', instResult.institucionId);
    }

    const { data, error } = await query.select(ESTUDIANTE_SELECT_FIELDS).single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al actualizar estudiante' }, { status: 500 });
  }
}

// DELETE — Elimina un estudiante
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const sb = getSupabaseAdmin();
    let query = sb.from('estudiantes').delete().eq('id', id);

    if (auth.session.inst) {
      query = query.eq('institucion_id', auth.session.inst);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al eliminar estudiante' }, { status: 500 });
  }
}
