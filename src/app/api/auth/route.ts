import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'admin_session';
const COOKIE_ROL = 'admin_rol';
const COOKIE_INST = 'admin_institucion_id';
const COOKIE_NOMBRE = 'admin_nombre';
const COOKIE_EMAIL = 'admin_email';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const { email, password, action } = await request.json();

    // Logout
    if (action === 'logout') {
      const cookieStore = await cookies();
      cookieStore.delete(COOKIE_NAME);
      cookieStore.delete(COOKIE_ROL);
      cookieStore.delete(COOKIE_INST);
      cookieStore.delete(COOKIE_NOMBRE);
      cookieStore.delete(COOKIE_EMAIL);
      return NextResponse.json({ success: true });
    }

    // Validate input & Backward Compatibility Fallback (e.g. cached login page)
    let userEmail = email ? email.trim().toLowerCase() : '';
    if (!userEmail && password) {
      if (password === 'admin2025') {
        userEmail = 'orlandoasisto@asisto.app';
      } else if (password === 'crc2025') {
        userEmail = 'colegiorafaelcastillo@asisto.app';
      }
    }

    if (!userEmail || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verificar contraseña con función SQL
    const { data: pwValid, error: pwError } = await supabaseAdmin
      .rpc('check_admin_password', {
        user_email: userEmail,
        user_password: password,
      });

    if (pwError || !pwValid) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // 2. Obtener datos del usuario
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios_sistema')
      .select('id, nombre_completo, email, rol, institucion_id, activo')
      .eq('email', userEmail)
      .eq('activo', true)
      .maybeSingle();

    if (userError || !usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 401 });
    }

    // 3. Actualizar último acceso
    await supabaseAdmin
      .from('usuarios_sistema')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', usuario.id);

    // 4. Generar token de sesión y setear cookies
    const sessionToken = `${usuario.rol}-${usuario.id}-auth`;

    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    };

    cookieStore.set(COOKIE_NAME, sessionToken, cookieOpts);
    cookieStore.set(COOKIE_ROL, usuario.rol, { ...cookieOpts, httpOnly: false });
    cookieStore.set(COOKIE_INST, usuario.institucion_id || '', { ...cookieOpts, httpOnly: false });
    cookieStore.set(COOKIE_NOMBRE, usuario.nombre_completo, { ...cookieOpts, httpOnly: false });
    cookieStore.set(COOKIE_EMAIL, usuario.email || '', { ...cookieOpts, httpOnly: false });

    return NextResponse.json({
      success: true,
      rol: usuario.rol,
      institucion_id: usuario.institucion_id,
      nombre: usuario.nombre_completo,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error del servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(COOKIE_NAME);

    if (!session?.value || !session.value.includes('-auth')) {
      return NextResponse.json({ authenticated: false, rol: null, institucion_id: null, nombre: '', email: '' });
    }

    const rol = cookieStore.get(COOKIE_ROL)?.value || null;
    const institucion_id = cookieStore.get(COOKIE_INST)?.value || null;
    const nombre = cookieStore.get(COOKIE_NOMBRE)?.value || '';
    const email = cookieStore.get(COOKIE_EMAIL)?.value || '';

    return NextResponse.json({
      authenticated: true,
      rol,
      institucion_id: institucion_id || null,
      nombre,
      email,
    });
  } catch {
    return NextResponse.json({ authenticated: false, rol: null, institucion_id: null, nombre: '', email: '' });
  }
}
