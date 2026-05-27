import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — Lista todos los estudiantes
export async function GET() {
  try {
    const sb = getAdmin();
    const { data, error } = await sb
      .from('estudiantes')
      .select('*')
      .order('nombre_completo');
    
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al obtener estudiantes' }, { status: 500 });
  }
}

// POST — Crea un nuevo estudiante
export async function POST(request: Request) {
  try {
    const sb = getAdmin();
    const body = await request.json();
    const {
      cedula,
      nombre_completo,
      grado,
      seccion,
      nombre_representante,
      correo_representante,
      qr_code,
      institucion_id,
      estado
    } = body;

    if (!cedula || !nombre_completo || !grado || !seccion || !nombre_representante || !correo_representante || !qr_code) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // Resolver institucion_id de forma dinámica si no viene en el payload
    let finalInstId = institucion_id;
    if (!finalInstId) {
      const { data: inst } = await sb.from('instituciones').select('id').limit(1).single();
      finalInstId = inst?.id || 'c4e8711a-f035-428c-b98f-69555a819ec7';
    }

    const { data, error } = await sb
      .from('estudiantes')
      .insert([{
        cedula: cedula.trim(),
        nombre_completo: nombre_completo.trim(),
        grado: grado.trim(),
        seccion: seccion.trim().toUpperCase(),
        nombre_representante: nombre_representante.trim(),
        correo_representante: correo_representante.trim(),
        qr_code,
        institucion_id: finalInstId,
        estado: estado || 'Activo'
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear estudiante' }, { status: 500 });
  }
}

// PUT — Actualiza un estudiante existente
export async function PUT(request: Request) {
  try {
    const sb = getAdmin();
    const body = await request.json();
    const {
      id,
      cedula,
      nombre_completo,
      grado,
      seccion,
      nombre_representante,
      correo_representante,
      qr_code,
      institucion_id,
      estado
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del estudiante es obligatorio' }, { status: 400 });
    }

    // Resolver institucion_id si no viene
    let finalInstId = institucion_id;
    if (!finalInstId) {
      const { data: inst } = await sb.from('instituciones').select('id').limit(1).single();
      finalInstId = inst?.id || 'c4e8711a-f035-428c-b98f-69555a819ec7';
    }

    const updateData: any = {};
    if (cedula !== undefined) updateData.cedula = cedula.trim();
    if (nombre_completo !== undefined) updateData.nombre_completo = nombre_completo.trim();
    if (grado !== undefined) updateData.grado = grado.trim();
    if (seccion !== undefined) updateData.seccion = seccion.trim().toUpperCase();
    if (nombre_representante !== undefined) updateData.nombre_representante = nombre_representante.trim();
    if (correo_representante !== undefined) updateData.correo_representante = correo_representante.trim();
    if (qr_code !== undefined) updateData.qr_code = qr_code;
    if (estado !== undefined) updateData.estado = estado;
    updateData.institucion_id = finalInstId;

    const { data, error } = await sb
      .from('estudiantes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al actualizar estudiante' }, { status: 500 });
  }
}

// DELETE — Elimina un estudiante
export async function DELETE(request: Request) {
  try {
    const sb = getAdmin();
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    
    const { error } = await sb.from('estudiantes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al eliminar estudiante' }, { status: 500 });
  }
}
