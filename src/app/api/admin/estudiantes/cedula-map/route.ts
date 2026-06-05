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
 * GET /api/admin/estudiantes/cedula-map
 * Returns a lightweight map: { [cedula_normalizada]: { id, institucion_id } }
 * Used by the bulk photo upload UI to match filenames to students without
 * loading all student data into the browser.
 */
export async function GET() {
  try {
    const sb = getAdmin();

    // Fetch only the fields we need — no photos, no email, very lightweight
    const { data, error } = await sb
      .from('estudiantes')
      .select('id, cedula, institucion_id')
      .eq('estado', 'Activo');

    if (error) throw new Error(error.message);

    // Build map: normalized cedula (digits only) → { id, institucion_id }
    const cedulaMap: Record<string, { id: string; institucion_id: string; cedula: string }> = {};
    for (const row of (data ?? []) as { id: string; cedula: string; institucion_id: string }[]) {
      // Normalize: remove prefix letters, dashes, spaces → pure digits
      const normalized = row.cedula.replace(/[^0-9]/g, '');
      if (normalized) {
        cedulaMap[normalized] = { id: row.id, institucion_id: row.institucion_id, cedula: row.cedula };
      }
    }

    return NextResponse.json({ ok: true, map: cedulaMap, total: Object.keys(cedulaMap).length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al obtener mapa de cédulas' },
      { status: 500 }
    );
  }
}
