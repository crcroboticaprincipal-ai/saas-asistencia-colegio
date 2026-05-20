import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — Lista todas las materias
export async function GET() {
  try {
    const sb = getAdmin();
    const { data, error } = await sb
      .from('materias')
      .select('id, nombre, codigo, nivel, created_at')
      .order('nombre');
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

// POST — Crea una materia
export async function POST(request: Request) {
  try {
    const sb = getAdmin();
    const body = await request.json();
    const { nombre, codigo, nivel, institucion_id } = body;

    if (!nombre?.trim() || !institucion_id) {
      return NextResponse.json({ error: 'Nombre e institucion_id son obligatorios' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('materias')
      .insert([{ nombre: nombre.trim(), codigo: codigo?.trim() || null, nivel: nivel || null, institucion_id }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

// DELETE — Elimina una materia
export async function DELETE(request: Request) {
  try {
    const sb = getAdmin();
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const { error } = await sb.from('materias').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
