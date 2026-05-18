import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolverCredencialesLogin } from '@/lib/login-pin';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, pin, institucion_nombre_corto } = body;

    if (!username || !pin || !institucion_nombre_corto) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const { email, password } = resolverCredencialesLogin({
      username,
      pin,
      institucion_nombre_corto,
    });

    // Intentar login con las credenciales internas
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Usuario o PIN incorrecto' },
        { status: 401 }
      );
    }

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
      user: {
        id: data.user.id,
        email: data.user.email,
        ...personalData,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
