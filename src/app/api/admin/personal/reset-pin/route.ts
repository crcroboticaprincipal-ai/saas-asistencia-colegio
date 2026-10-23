import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { personalId } = (await request.json()) as { personalId?: string };

    if (!personalId) {
      return NextResponse.json({ error: 'ID de personal requerido' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: personal, error: perErr } = await supabaseAdmin
      .from('personal')
      .select('id, nombres, apellidos, auth_user_id, institucion_id')
      .eq('id', personalId)
      .maybeSingle();

    if (perErr || !personal) {
      return NextResponse.json({ error: 'Usuario de personal no encontrado' }, { status: 404 });
    }

    const instResult = resolveInstitucion(session, personal.institucion_id);
    if (!instResult.ok) return instResult.response;

    const defaultHashedPin = await hashPassword('1234');

    const { error: dbUpdateErr } = await supabaseAdmin
      .from('personal')
      .update({
        pin_hash: defaultHashedPin,
        password_hash: null,
        usa_password_alfanumerico: false,
        solicita_restablecer: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personalId);

    if (dbUpdateErr) {
      return NextResponse.json({ error: 'Error al actualizar base de datos' }, { status: 500 });
    }

    if (personal.auth_user_id) {
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
        personal.auth_user_id,
        { password: '1234' },
      );
      if (authUpdateErr) {
        console.error('Error actualizando contraseña en Supabase Auth:', authUpdateErr.message);
      }
    }

    return NextResponse.json({ ok: true, message: 'PIN blanqueado a 1234 exitosamente' });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error del servidor' }, { status: 500 });
  }
}
