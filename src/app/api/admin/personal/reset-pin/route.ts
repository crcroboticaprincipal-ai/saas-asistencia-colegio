import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const { personalId } = await request.json();

    if (!personalId) {
      return NextResponse.json({ error: 'ID de personal requerido' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Obtener datos del personal
    const { data: personal, error: perErr } = await supabaseAdmin
      .from('personal')
      .select('*')
      .eq('id', personalId)
      .maybeSingle();

    if (perErr || !personal) {
      return NextResponse.json({ error: 'Usuario de personal no encontrado' }, { status: 404 });
    }

    // 2. Actualizar en base de datos: PIN a 1234, limpiar password_hash, limpiar solicita_restablecer
    const { error: dbUpdateErr } = await supabaseAdmin
      .from('personal')
      .update({
        pin_hash: '1234',
        password_hash: null,
        usa_password_alfanumerico: false,
        solicita_restablecer: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', personalId);

    if (dbUpdateErr) {
      return NextResponse.json({ error: 'Error al actualizar base de datos' }, { status: 500 });
    }

    // 3. Actualizar en Supabase Auth
    if (personal.auth_user_id) {
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
        personal.auth_user_id,
        { password: '1234' }
      );
      if (authUpdateErr) {
        console.error('Error actualizando contraseña en Supabase Auth:', authUpdateErr.message);
      }
    }

    return NextResponse.json({ ok: true, message: 'PIN blanqueado a 1234 exitosamente' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
