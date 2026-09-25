import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { siguienteGrado } from '@/lib/grados-catalogo';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const sb = getAdmin();

    // Resolve institucion_id
    const { data: inst } = await sb.from('instituciones').select('id').limit(1).single();
    const instId = inst?.id;
    if (!instId) {
      return NextResponse.json({ error: 'No se encontró la institución' }, { status: 400 });
    }

    // ── 1. Limpieza de materias y dependencias académicas ──
    // Eliminadas en orden inverso de dependencia (FK)

    const { error: errNotas } = await sb.from('notas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errNotas) throw new Error(`Error al limpiar notas: ${errNotas.message}`);

    const { error: errEval } = await sb.from('evaluaciones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errEval) throw new Error(`Error al limpiar evaluaciones: ${errEval.message}`);

    const { error: errAsisMat } = await sb.from('asistencia_materia').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAsisMat) throw new Error(`Error al limpiar asistencias a materias: ${errAsisMat.message}`);

    const { error: errAsig } = await sb.from('profesores_asignaciones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAsig) throw new Error(`Error al limpiar asignaciones de profesores: ${errAsig.message}`);

    const { error: errMat } = await sb.from('materias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errMat) throw new Error(`Error al limpiar materias: ${errMat.message}`);

    // ── 2. Promoción de Estudiantes usando catálogo canónico ──
    const { data: estudiantes, error: errEst } = await sb
      .from('estudiantes')
      .select('id, grado, estado')
      .eq('institucion_id', instId)
      .eq('estado', 'Activo');

    if (errEst) throw new Error(errEst.message);

    let graduadosCount = 0;
    let promovidosCount = 0;

    // Determinar año escolar próximo
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
      { status: 500 }
    );
  }
}
