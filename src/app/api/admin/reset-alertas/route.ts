import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/admin/reset-alertas
 *
 * Resets performance alert counters WITHOUT touching base attendance records.
 *
 * Body:
 *   { estudiante_id: string }  → surgical reset for one student
 *   { institucion_id: string } → mass reset for all students in the institution
 *
 * SAFETY: Only mutates alertas_inasistencia and alertas_retardo.
 *         The asistencias table is never touched.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      estudiante_id?: string;
      institucion_id?: string;
    };

    const { estudiante_id, institucion_id } = body;

    if (!estudiante_id && !institucion_id) {
      return NextResponse.json(
        { error: 'Se requiere estudiante_id o institucion_id' },
        { status: 400 }
      );
    }

    const sb = getAdmin();

    // Zero-out only alert counters — base records are never touched
    const resetPayload = {
      alertas_inasistencia: 0,
      alertas_retardo: 0,
      updated_at: new Date().toISOString(),
    };

    let updateQuery = sb.from('estudiantes').update(resetPayload);

    if (estudiante_id) {
      updateQuery = updateQuery.eq('id', estudiante_id);
    } else {
      // Explicit non-null check ensures institucion_id is string here
      updateQuery = updateQuery.eq('institucion_id', institucion_id as string);
    }

    const { error } = await updateQuery;

    if (error) {
      throw new Error(error.message);
    }

    const scope = estudiante_id
      ? `estudiante #${estudiante_id}`
      : `todos los estudiantes de institución #${institucion_id}`;

    return NextResponse.json({
      ok: true,
      message: `✅ Alertas reiniciadas para ${scope}.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al reiniciar alertas' },
      { status: 500 }
    );
  }
}
