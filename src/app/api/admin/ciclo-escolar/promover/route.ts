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

    // Get all active students for this institution — only the columns needed for promotion logic
    const { data: estudiantes, error } = await sb
      .from('estudiantes')
      .select('id, grado, estado')
      .eq('institucion_id', instId)
      .eq('estado', 'Activo');

    if (error) throw new Error(error.message);

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
      }

      if (nuevoGrado !== est.grado || nuevoEstado !== est.estado) {
        const { error: updErr } = await sb
          .from('estudiantes')
          .update({ grado: nuevoGrado, estado: nuevoEstado })
          .eq('id', est.id);
        if (updErr) throw new Error(updErr.message);
      }
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
