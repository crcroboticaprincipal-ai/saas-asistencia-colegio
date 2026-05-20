import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/admin/rrhh/calendario?personal_id=xxx&inicio=yyyy-MM-dd&fin=yyyy-MM-dd
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const personal_id = searchParams.get('personal_id');
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');

    const sb = getAdmin();

    // Fetch ALL personal (no filter = left-join semantics: everyone shows up)
    if (!personal_id) {
      const { data, error } = await sb
        .from('personal')
        .select('id, nombres, apellidos, rol, cargo, activo, institucion_id')
        .order('apellidos');
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, data: data ?? [] });
    }

    // Fetch asistencias for the given employee and date range
    if (!inicio || !fin) {
      return NextResponse.json({ error: 'inicio y fin son requeridos' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('asistencia_personal')
      .select('*')
      .eq('personal_id', personal_id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
