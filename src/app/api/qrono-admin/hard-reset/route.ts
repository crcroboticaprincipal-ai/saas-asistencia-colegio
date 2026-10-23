import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSuperadmin, resolveInstitucion } from '@/lib/api-auth';

/**
 * POST /api/qrono-admin/hard-reset
 *
 * Elimina en cascada todos los datos de prueba de la institución:
 *   asistencia_personal → pases → asistencias → estudiantes
 *
 * Preserva intactos: instituciones, personal, usuarios_sistema, materias,
 * horarios_plantillas, horarios_bloques, profesores_asignaciones.
 *
 * Exclusivo para Super Admin autenticado vía sesión firmada.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSuperadmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { confirmar, institucion_id } = body;

    if (!confirmar) {
      return NextResponse.json(
        { error: 'Operación no autorizada. Se requiere confirmación explícita del Super Admin.' },
        { status: 403 }
      );
    }

    const instResult = resolveInstitucion(auth.session, institucion_id);
    if (!instResult.ok) return instResult.response;

    const sb = getSupabaseAdmin();
    let instId = instResult.institucionId;

    if (!instId) {
      const { data: inst } = await sb.from('instituciones').select('id').eq('activo', true).limit(1).single();
      if (!inst?.id) {
        return NextResponse.json({ error: 'No se encontró institución activa' }, { status: 400 });
      }
      instId = inst.id;
    }

    const eliminados: Record<string, number> = {};

    // ── 1. Asistencia Personal ──────────────────────────────────────────────
    const { data: delAsisPer, error: e1 } = await sb
      .from('asistencia_personal')
      .delete()
      .eq('institucion_id', instId)
      .select('id');
    if (e1) console.warn('[hard-reset] asistencia_personal:', e1.message);
    eliminados.asistencia_personal = delAsisPer?.length ?? 0;

    // ── 2. Pases ────────────────────────────────────────────────────────────
    const { data: delPases, error: e2 } = await sb
      .from('pases')
      .delete()
      .eq('institucion_id', instId)
      .select('id');
    if (e2) console.warn('[hard-reset] pases:', e2.message);
    eliminados.pases = delPases?.length ?? 0;

    // ── 3. Asistencias de alumnos ───────────────────────────────────────────
    const { data: delAsis, error: e3 } = await sb
      .from('asistencias')
      .delete()
      .eq('institucion_id', instId)
      .select('id');
    if (e3) console.warn('[hard-reset] asistencias:', e3.message);
    eliminados.asistencias = delAsis?.length ?? 0;

    // ── 4. Asistencia de materias (aula) ────────────────────────────────────
    const { data: delAsisMat, error: e4 } = await sb
      .from('asistencia_materia')
      .delete()
      .eq('institucion_id', instId)
      .select('id');
    if (e4) console.warn('[hard-reset] asistencia_materia:', e4.message);
    eliminados.asistencia_materia = delAsisMat?.length ?? 0;

    // ── 5. Notas ────────────────────────────────────────────────────────────
    const { data: delNotas, error: e5 } = await sb
      .from('notas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (e5) console.warn('[hard-reset] notas:', e5.message);
    eliminados.notas = delNotas?.length ?? 0;

    // ── 6. Estudiantes ──────────────────────────────────────────────────────
    const { data: delEst, error: e6 } = await sb
      .from('estudiantes')
      .delete()
      .eq('institucion_id', instId)
      .select('id');
    if (e6) throw new Error(`Error crítico eliminando estudiantes: ${e6.message}`);
    eliminados.estudiantes = delEst?.length ?? 0;

    const totalEliminados = Object.values(eliminados).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      mensaje: '✅ Hard Reset completado. La base de datos está lista para la matrícula oficial.',
      eliminados,
      total: totalEliminados,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado en hard-reset';
    console.error('[hard-reset]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
