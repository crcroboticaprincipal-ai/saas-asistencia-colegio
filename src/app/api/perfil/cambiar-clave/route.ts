import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/api-auth';
import { hashPassword, verifyPassword } from '@/lib/password';

export async function POST(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { tipoUsuario, userId, claveActual, nuevaClave } = await request.json();

    if (!tipoUsuario || !userId || !claveActual || !nuevaClave) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (session.uid !== userId && session.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No tienes permiso para modificar este usuario' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (tipoUsuario === 'admin') {
      const { data: adminUser, error: adminErr } = await supabaseAdmin
        .from('usuarios_sistema')
        .select('id, email, password_hash')
        .eq('id', userId)
        .eq('activo', true)
        .maybeSingle();

      if (adminErr || !adminUser) {
        return NextResponse.json({ error: 'Usuario administrador no encontrado o inactivo' }, { status: 404 });
      }

      // Check current password (supports scrypt & RPC check)
      let isCurrentValid = false;
      if (adminUser.password_hash) {
        isCurrentValid = await verifyPassword(claveActual, adminUser.password_hash);
      } else {
        const { data: pwValid } = await supabaseAdmin.rpc('check_admin_password', {
          user_email: adminUser.email,
          user_password: claveActual,
        });
        isCurrentValid = !!pwValid;
      }

      if (!isCurrentValid) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
      }

      const newHash = await hashPassword(nuevaClave);
      const { error: updateErr } = await supabaseAdmin
        .from('usuarios_sistema')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateErr) {
        return NextResponse.json({ error: `Error al actualizar contraseña: ${updateErr.message}` }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: 'Contraseña actualizada exitosamente' });
    } else if (tipoUsuario === 'personal') {
      const { data: personalUser, error: perErr } = await supabaseAdmin
        .from('personal')
        .select('id, pin_hash, password_hash, usa_password_alfanumerico, auth_user_id')
        .eq('id', userId)
        .eq('activo', true)
        .maybeSingle();

      if (perErr || !personalUser) {
        return NextResponse.json({ error: 'Usuario del personal no encontrado o inactivo' }, { status: 404 });
      }

      const currentStored = personalUser.usa_password_alfanumerico
        ? personalUser.password_hash
        : personalUser.pin_hash;

      const isCurrentValid = await verifyPassword(claveActual, currentStored);
      if (!isCurrentValid) {
        return NextResponse.json({ error: 'El PIN o contraseña actual es incorrecto' }, { status: 401 });
      }

      const esPin = /^\d{4,6}$/.test(nuevaClave);
      const newHashed = await hashPassword(nuevaClave);

      const updates: Record<string, string | boolean | null> = {
        updated_at: new Date().toISOString(),
      };

      if (esPin) {
        updates.pin_hash = newHashed;
        updates.password_hash = null;
        updates.usa_password_alfanumerico = false;
      } else {
        updates.password_hash = newHashed;
        updates.pin_hash = null;
        updates.usa_password_alfanumerico = true;
      }

      const { error: dbUpdateErr } = await supabaseAdmin
        .from('personal')
        .update(updates)
        .eq('id', userId);

      if (dbUpdateErr) {
        return NextResponse.json({ error: 'Error al actualizar base de datos del personal' }, { status: 500 });
      }

      if (personalUser.auth_user_id) {
        const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
          personalUser.auth_user_id,
          { password: nuevaClave },
        );
        if (authUpdateErr) {
          console.error('Error actualizando contraseña en Supabase Auth:', authUpdateErr.message);
        }
      }

      return NextResponse.json({ ok: true, message: 'Credencial actualizada exitosamente' });
    } else {
      return NextResponse.json({ error: 'Tipo de usuario no válido' }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error del servidor' }, { status: 500 });
  }
}
