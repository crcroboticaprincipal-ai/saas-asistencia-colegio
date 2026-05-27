import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolverCredencialesLogin } from '@/lib/login-pin';

// Client is initialized dynamically inside the route handler

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Variables de entorno de Supabase (URL o SERVICE_ROLE_KEY) no configuradas. Verifica tu archivo .env.local.");
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { username, pin } = body;
    let institucion_nombre_corto = body.institucion_nombre_corto;

    if (!username || !pin) {
      return NextResponse.json({ error: 'Usuario y PIN son requeridos' }, { status: 400 });
    }

    if (!institucion_nombre_corto) {
      // 1. Buscar la institución del usuario en la tabla 'personal'
      const { data: pData, error: pError } = await supabaseAdmin
        .from('personal')
        .select('institucion_id')
        .eq('username', username.trim().toLowerCase())
        .eq('activo', true)
        .maybeSingle();

      if (pError || !pData) {
        return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 404 });
      }

      // 2. Buscar el nombre corto de la institución
      const { data: iData, error: iError } = await supabaseAdmin
        .from('instituciones')
        .select('nombre_corto')
        .eq('id', pData.institucion_id)
        .single();

      if (iError || !iData || !iData.nombre_corto) {
        return NextResponse.json({ error: 'La institución de este usuario no está configurada' }, { status: 400 });
      }

      institucion_nombre_corto = iData.nombre_corto;
    }

    const { email, password } = resolverCredencialesLogin({
      username,
      pin,
      institucion_nombre_corto,
    });

    // Intentar login con las credenciales internas
    let result = await supabaseAdmin.auth.signInWithPassword({ email, password });

    // Si falla, intentar con el dominio alternativo qrono.local (para soporte legacy)
    if (result.error && email.endsWith('.asisto.local')) {
      const altEmail = email.replace('.asisto.local', '.qrono.local');
      const retryResult = await supabaseAdmin.auth.signInWithPassword({ email: altEmail, password });
      if (!retryResult.error) {
        result = retryResult;
      }
    }

    if (result.error || !result.data.user) {
      return NextResponse.json(
        { error: 'Usuario o PIN incorrecto' },
        { status: 401 }
      );
    }

    const data = result.data;
    // Obtener datos del personal
    const { data: personalData } = await supabaseAdmin
      .from('personal')
      .select('id, nombres, apellidos, rol, cargo, institucion_id')
      .eq('auth_user_id', data.user.id)
      .eq('activo', true)
      .single();

    if (!personalData) {
      return NextResponse.json(
        { error: 'Personal no encontrado o inactivo' },
        { status: 403 }
      );
    }

    // Actualizar último acceso
    await supabaseAdmin
      .from('personal')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', personalData.id);

    return NextResponse.json({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      institucion_nombre_corto,
      user: {
        auth_id: data.user.id,
        email: data.user.email,
        ...personalData,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
