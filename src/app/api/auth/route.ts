import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { SESSION_COOKIE, signSession, getSession, sessionCookieOptions } from '@/lib/session';
import { loginAdminSchema, firstZodError } from '@/lib/validation';
import { rateLimit, rateLimitReset, clientIp } from '@/lib/rate-limit';

const COOKIE_LEGACY_NAME = 'admin_session';
const COOKIE_ROL = 'admin_rol';
const COOKIE_INST = 'admin_institucion_id';
const COOKIE_NOMBRE = 'admin_nombre';
const COOKIE_EMAIL = 'admin_email';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Logout
    if (body.action === 'logout') {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE);
      cookieStore.delete(COOKIE_LEGACY_NAME);
      cookieStore.delete(COOKIE_ROL);
      cookieStore.delete(COOKIE_INST);
      cookieStore.delete(COOKIE_NOMBRE);
      cookieStore.delete(COOKIE_EMAIL);
      return NextResponse.json(
        { success: true },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );
    }

    // Validate input with Zod
    const parsed = loginAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // Rate Limiting (5 intentos por cada 5 minutos por IP + Email)
    const ip = clientIp(request);
    const rlKey = `login-admin:${ip}:${email}`;
    const rl = rateLimit(rlKey, 5, 5 * 60 * 1000);

    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Reintenta en ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verificar contraseña con función RPC
    const { data: pwValid, error: pwError } = await supabaseAdmin.rpc('check_admin_password', {
      user_email: email,
      user_password: password,
    });

    if (pwError || !pwValid) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // 2. Obtener datos del usuario
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios_sistema')
      .select('id, nombre_completo, email, rol, institucion_id, activo')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle();

    if (userError || !usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 401 });
    }

    // Login exitoso: reseteamos rate limit
    rateLimitReset(rlKey);

    // 3. Actualizar último acceso
    await supabaseAdmin
      .from('usuarios_sistema')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', usuario.id);

    // 4. Firmar token HMAC-SHA256
    const tokenFirmado = await signSession(
      {
        uid: usuario.id,
        rol: usuario.rol,
        inst: usuario.institucion_id || null,
        kind: 'admin',
      },
      60 * 60 * 24 * 7 // 7 días
    );

    const cookieStore = await cookies();
    const opts = sessionCookieOptions('admin');

    // Cookie segura principal (firmada y HttpOnly)
    cookieStore.set(SESSION_COOKIE, tokenFirmado, opts);

    // Cookies informativas para la UI (no-sensibles)
    cookieStore.set(COOKIE_ROL, usuario.rol, { ...opts, httpOnly: false });
    cookieStore.set(COOKIE_INST, usuario.institucion_id || '', { ...opts, httpOnly: false });
    cookieStore.set(COOKIE_NOMBRE, usuario.nombre_completo, { ...opts, httpOnly: false });
    cookieStore.set(COOKIE_EMAIL, usuario.email || '', { ...opts, httpOnly: false });

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

export async function GET(request: Request) {
  try {
    const session = await getSession(request);

    if (!session || session.kind !== 'admin') {
      return NextResponse.json({ authenticated: false, rol: null, institucion_id: null, nombre: '', email: '' });
    }

    const cookieStore = await cookies();
    const nombre = cookieStore.get(COOKIE_NOMBRE)?.value || '';
    const email = cookieStore.get(COOKIE_EMAIL)?.value || '';

    return NextResponse.json({
      authenticated: true,
      rol: session.rol,
      institucion_id: session.inst,
      nombre,
      email,
    });
  } catch {
    return NextResponse.json({ authenticated: false, rol: null, institucion_id: null, nombre: '', email: '' });
  }
}
