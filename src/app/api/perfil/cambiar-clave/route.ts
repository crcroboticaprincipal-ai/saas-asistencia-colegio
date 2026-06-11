import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const { tipoUsuario, userId, claveActual, nuevaClave } = await request.json();

    if (!tipoUsuario || !userId || !claveActual || !nuevaClave) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (tipoUsuario === 'admin') {
      // 1. Obtener email del admin para check_admin_password
      const { data: adminUser, error: adminErr } = await supabaseAdmin
        .from('usuarios_sistema')
        .select('email')
        .eq('id', userId)
        .eq('activo', true)
        .maybeSingle();

      if (adminErr || !adminUser) {
        return NextResponse.json({ error: 'Usuario administrador no encontrado o inactivo' }, { status: 404 });
      }

      // 2. Verificar clave actual
      const { data: pwValid, error: pwError } = await supabaseAdmin
        .rpc('check_admin_password', {
          user_email: adminUser.email,
          user_password: claveActual,
        });

      if (pwError || !pwValid) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 });
      }

      // 3. Actualizar la contraseña en la base de datos usando la RPC
      const { error: updateErr } = await supabaseAdmin.rpc('update_admin_password', {
        user_id: userId,
        new_password: nuevaClave
      });

      if (updateErr) {
        return NextResponse.json({ error: `Error al actualizar contraseña: ${updateErr.message}` }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: 'Contraseña actualizada exitosamente' });

    } else if (tipoUsuario === 'personal') {
      // 1. Obtener datos del personal
      const { data: personalUser, error: perErr } = await supabaseAdmin
        .from('personal')
        .select('*')
        .eq('id', userId)
        .eq('activo', true)
        .maybeSingle();

      if (perErr || !personalUser) {
        return NextResponse.json({ error: 'Usuario del personal no encontrado o inactivo' }, { status: 404 });
      }

      // 2. Verificar contraseña actual
      const currentStored = personalUser.usa_password_alfanumerico 
        ? personalUser.password_hash 
        : personalUser.pin_hash;

      if (currentStored !== claveActual) {
        return NextResponse.json({ error: 'El PIN o contraseña actual es incorrecto' }, { status: 401 });
      }

      // 3. Determinar si la nueva clave es PIN (solo números entre 4 y 6 dígitos) o alfanumérica
      const esPin = /^\d{4,6}$/.test(nuevaClave);

      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (esPin) {
        updates.pin_hash = nuevaClave;
        updates.password_hash = null;
        updates.usa_password_alfanumerico = false;
      } else {
        updates.password_hash = nuevaClave;
        updates.pin_hash = null;
        updates.usa_password_alfanumerico = true;
      }

      // 4. Actualizar en base de datos personal
      const { error: dbUpdateErr } = await supabaseAdmin
        .from('personal')
        .update(updates)
        .eq('id', userId);

      if (dbUpdateErr) {
        return NextResponse.json({ error: 'Error al actualizar base de datos del personal' }, { status: 500 });
      }

      // 5. Actualizar en Supabase Auth
      if (personalUser.auth_user_id) {
        const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
          personalUser.auth_user_id,
          { password: nuevaClave }
        );
        if (authUpdateErr) {
          console.error('Error actualizando contraseña en Supabase Auth:', authUpdateErr.message);
          // Ojo: no bloqueamos si ya se cambió en personal, pero lo ideal es que ambos estén sincronizados.
        }
      }

      return NextResponse.json({ ok: true, message: 'Credencial actualizada exitosamente' });
    } else {
      return NextResponse.json({ error: 'Tipo de usuario no válido' }, { status: 400 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
