import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { hashPassword } from '@/lib/password';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { email, pin, nombres, apellidos, rol, username, institucion_id } = body as {
      email?: string;
      pin?: string;
      nombres?: string;
      apellidos?: string;
      rol?: string;
      username?: string;
      institucion_id?: string;
    };

    if (!email || !pin || !nombres) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const finalInstitucionId = instResult.institucionId;

    if (!finalInstitucionId) {
      return NextResponse.json({ error: 'Institución obligatoria' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: pin,
      email_confirm: true,
      user_metadata: { nombres: nombres.trim(), apellidos: apellidos?.trim(), username: username?.trim() },
      app_metadata: { rol: rol || 'docente', institucion_id: finalInstitucionId },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: '⚠️ Error: El documento o usuario ya se encuentra registrado' },
          { status: 409 },
        );
      }
      throw new Error(authError.message);
    }

    const hashedPin = await hashPassword(pin);

    if (authData.user && username) {
      await supabaseAdmin
        .from('personal')
        .update({
          auth_user_id: authData.user.id,
          pin_hash: hashedPin,
          institucion_id: finalInstitucionId,
        })
        .eq('username', username.trim().toLowerCase())
        .eq('institucion_id', finalInstitucionId);
    }

    return NextResponse.json({ ok: true, userId: authData.user?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
