import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { generarEmailInterno } from '@/lib/login-pin';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { nombres, apellidos, cedula, correo, telefono, cargo, rol, username, pin, institucion_id } = body;

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const finalInstitucionId = instResult.institucionId;

    if (!finalInstitucionId) {
      return NextResponse.json({ error: 'Se requiere seleccionar una institución' }, { status: 400 });
    }

    const { data: instData, error: instError } = await supabaseAdmin
      .from('instituciones')
      .select('nombre_corto')
      .eq('id', finalInstitucionId)
      .single();

    if (instError || !instData) {
      return NextResponse.json({ error: 'Institución no encontrada' }, { status: 404 });
    }

    const nombreCorto = instData.nombre_corto || 'INST';
    let authUserId: string | null = null;

    if (username && pin) {
      const email = generarEmailInterno(username, nombreCorto);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { nombres, apellidos, username },
        app_metadata: {
          rol,
          institucion_id: finalInstitucionId,
        },
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          // Ya existe en auth
        } else {
          throw new Error(authError.message);
        }
      }

      if (authData?.user) {
        authUserId = authData.user.id;
      } else {
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const found = existingUser.users.find((u) => u.email === email);
        if (found) authUserId = found.id;
      }
    }

    const { data: personalData, error: dbError } = await supabaseAdmin
      .from('personal')
      .insert([
        {
          nombres: nombres ? String(nombres).trim() : '',
          apellidos: apellidos ? String(apellidos).trim() : '',
          cedula: cedula || null,
          correo: correo || null,
          telefono: telefono || null,
          cargo: cargo || null,
          rol: rol || 'docente',
          username: username || null,
          auth_user_id: authUserId,
          institucion_id: finalInstitucionId,
        },
      ])
      .select('id, nombres, apellidos, cedula, correo, telefono, cargo, rol, username, institucion_id, activo')
      .single();

    if (dbError) {
      if (
        dbError.message.includes('duplicate key') ||
        dbError.message.includes('unique constraint') ||
        dbError.code === '23505'
      ) {
        return NextResponse.json(
          { error: '⚠️ Error: El documento o usuario ya se encuentra registrado' },
          { status: 409 },
        );
      }
      throw new Error(dbError.message);
    }

    return NextResponse.json({ ok: true, personal: personalData });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
