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
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim().replace(/^"|"$/g, '');
        }
      }
    } catch (e) {
      console.warn('Manual reading of .env.local failed:', e);
    }
  }

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/estudiantes/filter-options?institucion_id=xxx
 *
 * Returns distinct grado and seccion values from the estudiantes table.
 * Consolidated into a single query to halve round-trips.
 * Used to populate the filter dropdowns in the UI.
 */
export async function GET(request: Request) {
  try {
    const sb = getAdmin();
    const { searchParams } = new URL(request.url);
    const institucion_id = searchParams.get('institucion_id');

    // Single query — fetch both columns at once
    let query = sb
      .from('estudiantes')
      .select('grado, seccion')
      .eq('estado', 'Activo')
      .order('grado');

    if (institucion_id) {
      query = query.eq('institucion_id', institucion_id);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Deduplicate in-memory (cheap JS operation on the filtered set)
    const grados = [...new Set((data ?? []).map((r) => r.grado).filter(Boolean))].sort();
    const secciones = [...new Set((data ?? []).map((r) => r.seccion).filter(Boolean))].sort();

    return NextResponse.json({ ok: true, grados, secciones });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener opciones de filtro' },
      { status: 500 }
    );
  }
}
