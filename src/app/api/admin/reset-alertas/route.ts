import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = (await request.json()) as {
      estudiante_id?: string;
      institucion_id?: string;
    };

    const { estudiante_id, institucion_id } = body;

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;

    if (!estudiante_id && !targetInstitucionId) {
      return NextResponse.json(
        { error: 'Se requiere estudiante_id o institucion_id' },
        { status: 400 },
      );
    }

    const sb = getSupabaseAdmin();

    const resetPayload = {
      alertas_inasistencia: 0,
      alertas_retardo: 0,
      updated_at: new Date().toISOString(),
    };

    let updateQuery = sb.from('estudiantes').update(resetPayload);

    if (estudiante_id) {
      updateQuery = updateQuery.eq('id', estudiante_id);
      if (targetInstitucionId) {
        updateQuery = updateQuery.eq('institucion_id', targetInstitucionId);
      }
    } else {
      updateQuery = updateQuery.eq('institucion_id', targetInstitucionId as string);
    }

    const { error } = await updateQuery;
    if (error) {
      throw new Error(error.message);
    }

    const scope = estudiante_id
      ? `estudiante #${estudiante_id}`
      : `todos los estudiantes de institución #${targetInstitucionId}`;

    return NextResponse.json({
      ok: true,
      message: `✅ Alertas reiniciadas para ${scope}.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al reiniciar alertas' },
      { status: 500 },
    );
  }
}
