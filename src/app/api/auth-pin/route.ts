import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolverCredencialesLogin, validarPin } from '@/lib/login-pin';
import { rateLimit, rateLimitReset, clientIp } from '@/lib/rate-limit';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { verifyPassword, hashPassword, isHashed } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username ? String(body.username).trim().toLowerCase() : '';
    const pin = body.pin ? String(body.pin).trim() : '';
    let institucion_nombre_corto = body.institucion_nombre_corto;

    if (!username || !pin) {
      return NextResponse.json({ error: 'Usuario y PIN son requeridos' }, { status: 400 });
    }

    const pinVal = validarPin(pin);
    if (!pinVal.valido) {
      return NextResponse.json({ error: pinVal.error }, { status: 400 });
    }

    // Rate Limit (5 intentos por 5 min por IP+username)
    const ip = clientIp(req);
    const rlKey = `login-pin:${ip}:${username}`;
    const rl = rateLimit(rlKey, 5, 5 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Reintenta en ${rl.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Buscar personal por username
    const { data: personalData, error: pError } = await supabaseAdmin
      .from('personal')
      .select('id, nombres, apellidos, rol, cargo, institucion_id, pin_hash, password_hash, usa_password_alfanumerico, auth_user_id, activo')
      .eq('username', username)
      .eq('activo', true)
      .maybeSingle();

    if (pError || !personalData) {
      return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 401 });
    }

    // 2. Verificar PIN (soporta scrypt y migración transparente de texto plano)
    const currentStored = personalData.usa_password_alfanumerico
      ? personalData.password_hash
      : personalData.pin_hash;

    const isValidPin = verifyPassword(pin, currentStored);

    if (!isValidPin) {
      return NextResponse.json({ error: 'Usuario o PIN incorrecto' }, { status: 401 });
    }

    // Login exitoso: reseteamos rate limit
    rateLimitReset(rlKey);

    // Migración transparente a hash scrypt si aún estaba en texto plano
    if (currentStored && !isHashed(currentStored)) {
      const newHash = hashPassword(pin);
      const updateField = personalData.usa_password_alfanumerico ? { password_hash: newHash } : { pin_hash: newHash };
      await supabaseAdmin.from('personal').update(updateField).eq('id', personalData.id);
    }

    // 3. Supabase Auth sync (si está configurado)
    if (!institucion_nombre_corto) {
      const { data: iData } = await supabaseAdmin
        .from('instituciones')
        .select('nombre_corto')
        .eq('id', personalData.institucion_id)
        .maybeSingle();
      institucion_nombre_corto = iData?.nombre_corto || 'CRC';
    }

    let authSession = null;
    try {
      const { email, password } = resolverCredencialesLogin({
        username,
        pin,
        institucion_nombre_corto,
      });
      let result = await supabaseAdmin.auth.signInWithPassword({ email, password });
      if (result.error && email.endsWith('.asisto.local')) {
        const altEmail = email.replace('.asisto.local', '.qrono.local');
        const retry = await supabaseAdmin.auth.signInWithPassword({ email: altEmail, password });
        if (!retry.error) result = retry;
      }
      authSession = result.data?.session;
    } catch {
      // Si la cuenta auth nativa aún no está creada, no se detiene la sesión local
    }

    // 4. Firmar cookie de sesión HMAC (kind: 'personal')
    const tokenFirmado = await signSession(
      {
        uid: personalData.id,
        rol: personalData.rol || 'personal',
        inst: personalData.institucion_id,
        kind: 'personal',
      },
      60 * 60 * 24 * 30 // 30 días
    );

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, tokenFirmado, sessionCookieOptions('personal'));

    // Actualizar último acceso
    await supabaseAdmin
      .from('personal')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', personalData.id);

    return NextResponse.json({
      access_token: authSession?.access_token || tokenFirmado,
      refresh_token: authSession?.refresh_token,
      institucion_nombre_corto,
      user: {
        auth_id: personalData.auth_user_id || personalData.id,
        email: `${username}@${institucion_nombre_corto.toLowerCase()}.asisto.local`,
        id: personalData.id,
        nombres: personalData.nombres,
        apellidos: personalData.apellidos,
        rol: personalData.rol,
        cargo: personalData.cargo,
        institucion_id: personalData.institucion_id,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
