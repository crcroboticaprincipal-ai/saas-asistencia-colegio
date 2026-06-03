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
    throw new Error(
      '⚠️ Error crítico: La variable SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. ' +
      'Si estás en desarrollo local, por favor reinicia tu servidor (npm run dev) para cargar las variables del archivo .env.local.'
    );
  }

  // Validar rol del JWT
  let role = 'unknown';
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      role = JSON.parse(payload).role;
    }
  } catch (e) {
    console.error('Error decodificando JWT de service_role:', e);
  }

  if (role !== 'service_role') {
    throw new Error(
      `⚠️ Error crítico: La llave configurada como SUPABASE_SERVICE_ROLE_KEY tiene el rol "${role}" en lugar de "service_role". ` +
      'Por favor, asegúrate de configurar la llave service_role correcta (no la anon_key) en tus variables de entorno y reiniciar el servidor.'
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — Lista estudiantes con paginación server-side via .range()
export async function GET(request: Request) {
  try {
    const sb = getAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const search = searchParams.get('search')?.trim() ?? '';
    const from = page * limit;
    const to = from + limit - 1;

    let query = sb
      .from('estudiantes')
      .select('*', { count: 'exact' })
      .order('nombre_completo');

    // Filtro de búsqueda server-side (ilike en columnas indexadas)
    if (search) {
      query = query.or(
        `nombre_completo.ilike.%${search}%,cedula.ilike.%${search}%,grado.ilike.%${search}%,seccion.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
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
      const { data: inst, error: instErr } = await sb
        .from('instituciones')
        .select('id')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      if (instErr || !inst) {
        return NextResponse.json({ error: 'No se encontró una institución activa. Verifique la configuración.' }, { status: 400 });
      }
      finalInstId = inst.id;
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
      const { data: inst, error: instErr } = await sb
        .from('instituciones')
        .select('id')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      if (instErr || !inst) {
        return NextResponse.json({ error: 'No se encontró una institución activa.' }, { status: 400 });
      }
      finalInstId = inst.id;
    }

    const updateData: Record<string, string | null | boolean> = {};
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
