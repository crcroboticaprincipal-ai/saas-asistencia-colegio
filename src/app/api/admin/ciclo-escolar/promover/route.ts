import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    // Se eliminan en orden inverso de dependencia para evitar conflictos de llave foránea (FK)
    
    // A. Notas
    const { error: errNotas } = await sb
      .from('notas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errNotas) throw new Error(`Error al limpiar notas: ${errNotas.message}`);

    // B. Evaluaciones
    const { error: errEval } = await sb
      .from('evaluaciones')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errEval) throw new Error(`Error al limpiar evaluaciones: ${errEval.message}`);

    // C. Asistencias a materias
    const { error: errAsisMat } = await sb
      .from('asistencia_materia')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAsisMat) throw new Error(`Error al limpiar asistencias a materias: ${errAsisMat.message}`);

    // D. Asignaciones de profesores
    const { error: errAsig } = await sb
      .from('profesores_asignaciones')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAsig) throw new Error(`Error al limpiar asignaciones de profesores: ${errAsig.message}`);

    // E. Catálogo de materias
    const { error: errMat } = await sb
      .from('materias')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errMat) throw new Error(`Error al limpiar materias: ${errMat.message}`);

    // ── 2. Promoción de Estudiantes ──
    // Get all active students for this institution
    const { data: estudiantes, error: errEst } = await sb
      .from('estudiantes')
      .select('id, grado, estado')
      .eq('institucion_id', instId)
      .eq('estado', 'Activo');

    if (errEst) throw new Error(errEst.message);

    let graduadosCount = 0;
    let promovidosCount = 0;

    const updates = (estudiantes || []).map(async (est) => {
      let nuevoGrado = est.grado;
      let nuevoEstado = est.estado;

      const g = est.grado.trim().toUpperCase();

      if (g === '5TO AÑO' || g === '5T') {
        nuevoEstado = 'Graduado';
        graduadosCount++;
      } else if (g === '4TO AÑO' || g === '4T') {
        nuevoGrado = est.grado.toLowerCase().includes('año') ? '5to Año' : '5T';
        promovidosCount++;
      } else if (g === '3ER AÑO' || g === '3T') {
        nuevoGrado = est.grado.toLowerCase().includes('año') ? '4to Año' : '4T';
        promovidosCount++;
      } else if (g === '2DO AÑO' || g === '2T') {
        nuevoGrado = est.grado.toLowerCase().includes('año') ? '3er Año' : '3T';
        promovidosCount++;
      } else if (g === '1ER AÑO' || g === '1T') {
        nuevoGrado = est.grado.toLowerCase().includes('año') ? '2do Año' : '2T';
        promovidosCount++;
      } else {
        promovidosCount++;
      }

      // Preparar payload de actualización
      const updatePayload: Record<string, any> = {
        alertas_inasistencia: 0,
        alertas_retardo: 0,
        updated_at: new Date().toISOString()
      };

      if (nuevoEstado === 'Graduado') {
        updatePayload.estado = 'Graduado';
      } else {
        updatePayload.estado = 'Activo';
        updatePayload.ano_escolar = '2026-2027';
      }

      if (nuevoGrado !== est.grado) {
        updatePayload.grado = nuevoGrado;
      }

      const { error: updErr } = await sb
        .from('estudiantes')
        .update(updatePayload)
        .eq('id', est.id);

      if (updErr) throw new Error(updErr.message);
    });

    await Promise.all(updates);

    return NextResponse.json({
      ok: true,
      graduados: graduadosCount,
      promovidos: promovidosCount,
      total: (estudiantes || []).length
    });
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Error al promover año escolar'
    }, { status: 500 });
  }
}
