import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { siguienteGrado } from '@/lib/grados-catalogo';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const requestedInst = body?.institucion_id;

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const instId = instResult.institucionId;

    if (!instId) {
      return NextResponse.json({ error: 'No se encontró la institución' }, { status: 400 });
    }

    // ── 1. Limpieza de materias y dependencias académicas en la institución ──
    const { error: errNotas } = await sb.from('notas').delete().eq('institucion_id', instId);
    if (errNotas) console.warn('[promover] Warning notas delete:', errNotas.message);

    const { error: errEval } = await sb.from('evaluaciones').delete().eq('institucion_id', instId);
    if (errEval) console.warn('[promover] Warning evaluaciones delete:', errEval.message);

    const { error: errAsisMat } = await sb.from('asistencia_materia').delete().eq('institucion_id', instId);
    if (errAsisMat) console.warn('[promover] Warning asistencia_materia delete:', errAsisMat.message);

    const { error: errAsig } = await sb.from('profesores_asignaciones').delete().eq('institucion_id', instId);
    if (errAsig) console.warn('[promover] Warning asignaciones delete:', errAsig.message);

    const { error: errMat } = await sb.from('materias').delete().eq('institucion_id', instId);
    if (errMat) console.warn('[promover] Warning materias delete:', errMat.message);

    // ── 2. Promoción de Estudiantes usando catálogo canónico ──
    const { data: estudiantes, error: errEst } = await sb
      .from('estudiantes')
      .select('id, grado, estado')
      .eq('institucion_id', instId)
      .eq('estado', 'Activo');

    if (errEst) throw new Error(errEst.message);

    let graduadosCount = 0;
    let promovidosCount = 0;

    const currentYear = new Date().getFullYear();
    const proximoCiclo = `${currentYear}-${currentYear + 1}`;

    const updates = (estudiantes || []).map(async (est) => {
      const siguiente = siguienteGrado(est.grado);
      const esGraduado = siguiente === 'Graduado';

      if (esGraduado) {
        graduadosCount++;
      } else {
        promovidosCount++;
      }

      const updatePayload: Record<string, unknown> = {
        alertas_inasistencia: 0,
        alertas_retardo: 0,
        updated_at: new Date().toISOString(),
      };

      if (esGraduado) {
        updatePayload.estado = 'Graduado';
      } else {
        updatePayload.estado = 'Activo';
        updatePayload.grado = siguiente;
        updatePayload.ano_escolar = proximoCiclo;
      }

      const { error: updErr } = await sb.from('estudiantes').update(updatePayload).eq('id', est.id);
      if (updErr) throw new Error(updErr.message);
    });

    await Promise.all(updates);

    return NextResponse.json({
      ok: true,
      ciclo: proximoCiclo,
      graduados: graduadosCount,
      promovidos: promovidosCount,
      total: (estudiantes || []).length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al promover año escolar' },
      { status: 500 },
    );
  }
}
