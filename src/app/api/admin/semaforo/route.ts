import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/semaforo?institucion_id=xxx
 *
 * Returns attendance incident counts per student for the current month,
 * aggregated server-side in PostgreSQL instead of the browser.
 * This keeps the response payload small (≤50 rows) regardless of student count.
 */

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const institucion_id = searchParams.get('institucion_id');

    const sb = getAdmin();

    const now = new Date();
    const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Build the query — aggregate directly in the database
    let query = sb
      .from('asistencias')
      .select(`
        estudiante_id,
        estudiantes (nombre_completo, grado, seccion)
      `)
      .gte('fecha', firstDayStr);

    if (institucion_id) {
      query = query.eq('institucion_id', institucion_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by student in-memory (data is already scoped to the month)
    const grouped: Record<string, {
      nombre_completo: string;
      grado: string;
      seccion: string;
      count: number;
      id: string;
    }> = {};

    for (const row of (data ?? [])) {
      const key = row.estudiante_id;
      // Supabase join may return array or single object depending on relationship type
      const estRaw = row.estudiantes;
      const est = Array.isArray(estRaw) ? estRaw[0] : estRaw;
      if (!key || !est) continue;

      if (!grouped[key]) {
        grouped[key] = {
          nombre_completo: est.nombre_completo,
          grado: est.grado,
          seccion: est.seccion,
          count: 0,
          id: key,
        };
      }
      grouped[key].count += 1;
    }

    // Sort descending by incidence count, return top 50
    const sorted = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return NextResponse.json({ ok: true, data: sorted });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener semáforo' },
      { status: 500 }
    );
  }
}
