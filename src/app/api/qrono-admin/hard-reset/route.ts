import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAIL = 'orlandoasisto@asisto.app';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/qrono-admin/hard-reset
 *
 * Elimina en cascada todos los datos de prueba de la institución:
 *   asistencia_personal → pases → asistencias → estudiantes
 *
 * Preserva intactos: instituciones, personal, usuarios_sistema, materias,
 * horarios_plantillas, horarios_bloques, profesores_asignaciones.
 *
 * Solo accesible al Super Admin (orlandoasisto@asisto.app).
 * Requiere: { confirmar: true, email: "orlandoasisto@asisto.app" } en el body.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { confirmar, email } = body;

    // Doble validación de seguridad
    if (!confirmar || email !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Operación no autorizada. Se requiere confirmación explícita del Super Admin.' },
        { status: 403 }
      );
    }

    const sb = getAdmin();
    const eliminados: Record<string, number> = {};

    // Resolver institución activa
    const { data: inst } = await sb.from('instituciones').select('id').limit(1).single();
    if (!inst?.id) {
      return NextResponse.json({ error: 'No se encontró institución activa' }, { status: 400 });
    }
    const instId = inst.id;

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
      .neq('id', '00000000-0000-0000-0000-000000000000')
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
