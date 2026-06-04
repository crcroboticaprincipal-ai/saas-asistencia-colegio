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
 * GET /api/admin/estudiantes/filter-options
 * Returns distinct grado and seccion values from the estudiantes table.
 * Used to populate the filter dropdowns in the UI.
 */
export async function GET() {
  try {
    const sb = getAdmin();

    // Fetch distinct grados
    const { data: gradosData, error: gradosErr } = await sb
      .from('estudiantes')
      .select('grado')
      .eq('estado', 'Activo')
      .order('grado');

    if (gradosErr) throw new Error(gradosErr.message);

    // Fetch distinct secciones
    const { data: seccionesData, error: seccionesErr } = await sb
      .from('estudiantes')
      .select('seccion')
      .eq('estado', 'Activo')
      .order('seccion');

    if (seccionesErr) throw new Error(seccionesErr.message);

    // Deduplicate
    const grados = [...new Set((gradosData ?? []).map((r: { grado: string }) => r.grado).filter(Boolean))].sort();
    const secciones = [...new Set((seccionesData ?? []).map((r: { seccion: string }) => r.seccion).filter(Boolean))].sort();

    return NextResponse.json({ ok: true, grados, secciones });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener opciones de filtro' },
      { status: 500 }
    );
  }
}
