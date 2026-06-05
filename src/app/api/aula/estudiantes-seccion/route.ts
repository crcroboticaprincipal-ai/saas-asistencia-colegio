import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf8');
        const m = raw.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (m?.[1]) key = m[1].trim().replace(/^"|"$/g, '');
      }
    } catch { /* ignore */ }
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/aula/estudiantes-seccion
 * Query: ?grado=&seccion=&institucion_id=
 *
 * Returns students of a specific grade+section with today's porteria entry time (if any).
 */
export async function GET(request: Request) {
  try {
    const sb = getAdmin();
    const { searchParams } = new URL(request.url);
    const grado = searchParams.get('grado')?.trim() ?? '';
    const seccion = searchParams.get('seccion')?.trim().toUpperCase() ?? '';
    const institucionId = searchParams.get('institucion_id')?.trim() ?? '';

    if (!grado || !seccion) {
      return NextResponse.json({ error: 'grado y seccion son requeridos' }, { status: 400 });
    }

    // 1. Fetch students of this section
    let estQuery = sb
      .from('estudiantes')
      .select('id, nombre_completo, cedula, foto_url, grado, seccion, institucion_id, qr_code')
      .eq('grado', grado)
      .eq('seccion', seccion)
      .eq('estado', 'Activo')
      .order('nombre_completo');

    if (institucionId) {
      estQuery = estQuery.eq('institucion_id', institucionId);
    }

    const { data: estudiantes, error: estErr } = await estQuery;
    if (estErr) throw new Error(estErr.message);

    const studentIds = (estudiantes ?? []).map((e: { id: string }) => e.id);

    // 2. Fetch today's porteria entries for these students
    const todayStr = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
    let porteriaMap: Record<string, string> = {};

    if (studentIds.length > 0) {
      const { data: registros } = await sb
        .from('registros_asistencia')
        .select('estudiante_id, hora_entrada')
        .in('estudiante_id', studentIds)
        .eq('fecha', todayStr)
        .not('hora_entrada', 'is', null);

      if (registros) {
        for (const r of registros as { estudiante_id: string; hora_entrada: string }[]) {
          porteriaMap[r.estudiante_id] = r.hora_entrada;
        }
      }
    }

    // 3. Fetch today's classroom attendance (asistencia_materia) to exclude already-marked
    // We return this so the UI can pre-filter the swipe pile if the teacher re-opens the session
    const { data: asistenciaHoy } = await sb
      .from('asistencia_materia')
      .select('estudiante_id, estado')
      .in('estudiante_id', studentIds)
      .eq('fecha', todayStr);

    const asistenciaMap: Record<string, string> = {};
    if (asistenciaHoy) {
      for (const a of asistenciaHoy as { estudiante_id: string; estado: string }[]) {
        asistenciaMap[a.estudiante_id] = a.estado;
      }
    }

    // 4. Compose response
    const result = (estudiantes ?? []).map((est: {
      id: string;
      nombre_completo: string;
      cedula: string;
      foto_url: string | null;
      grado: string;
      seccion: string;
      institucion_id: string;
      qr_code: string;
    }) => ({
      ...est,
      hora_entrada_porteria: porteriaMap[est.id] ?? null,
      asistencia_aula_hoy: asistenciaMap[est.id] ?? null,
    }));

    return NextResponse.json({ ok: true, data: result, total: result.length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener estudiantes' },
      { status: 500 }
    );
  }
}
