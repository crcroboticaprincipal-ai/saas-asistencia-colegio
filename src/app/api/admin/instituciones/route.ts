import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/admin/instituciones — Lista todas las instituciones
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Credenciales de servidor no configuradas' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabaseAdmin
      .from('instituciones')
      .select('id, nombre, nombre_corto, nivel_educativo, plan_suscripcion, activo, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/instituciones — Crea una nueva institución
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Credenciales de servidor no configuradas' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { nombre, nombre_corto, nivel_educativo } = await request.json();

    if (!nombre || !nivel_educativo) {
      return NextResponse.json({ error: 'Nombre y nivel educativo son obligatorios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('instituciones')
      .insert([{
        nombre: nombre.trim(),
        nombre_corto: nombre_corto?.trim() || null,
        nivel_educativo,
        plan_suscripcion: 'starter',
        activo: true,
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
