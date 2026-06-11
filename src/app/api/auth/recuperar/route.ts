import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generarHtmlCorreoRecuperacion } from '@/lib/email';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const { action, username, personalId, newPassword } = await request.json();

    const supabaseAdmin = getSupabaseAdmin();

    if (action === 'GET_USER') {
      if (!username) {
        return NextResponse.json({ error: 'Nombre de usuario requerido' }, { status: 400 });
      }

      // Buscar personal
      const { data: personal, error: perErr } = await supabaseAdmin
        .from('personal')
        .select('id, nombres, apellidos, correo, username, activo, institucion_id')
        .eq('username', username.trim().toLowerCase())
        .eq('activo', true)
        .maybeSingle();

      if (perErr || !personal) {
        return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        user: {
          id: personal.id,
          nombres: personal.nombres,
          apellidos: personal.apellidos,
          correo: personal.correo || null,
          hasEmail: !!personal.correo && personal.correo.includes('@'),
        }
      });
    }

    if (action === 'VIA_A') {
      if (!personalId) {
        return NextResponse.json({ error: 'ID de personal requerido' }, { status: 400 });
      }

      // 1. Obtener personal e institución
      const { data: personal, error: perErr } = await supabaseAdmin
        .from('personal')
        .select('id, nombres, apellidos, correo, auth_user_id, instituciones(nombre)')
        .eq('id', personalId)
        .maybeSingle();

      if (perErr || !personal) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      if (!personal.correo) {
        return NextResponse.json({ error: 'El usuario no tiene correo registrado' }, { status: 400 });
      }

      // 2. Generar código temporal de 6 dígitos
      const tempCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 3. Actualizar base de datos de personal
      // Como es un PIN temporal de restablecimiento, lo ponemos como pin_hash
      const { error: dbErr } = await supabaseAdmin
        .from('personal')
        .update({
          pin_hash: tempCode,
          password_hash: null,
          usa_password_alfanumerico: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', personalId);

      if (dbErr) {
        return NextResponse.json({ error: 'Error al generar credencial temporal' }, { status: 500 });
      }

      // 4. Actualizar en Supabase Auth
      if (personal.auth_user_id) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
          personal.auth_user_id,
          { password: tempCode }
        );
        if (authErr) {
          console.error('[recuperar] Error actualizando contraseña en Auth:', authErr.message);
        }
      }

      // 5. Enviar correo usando Resend
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const nombreColegio = (personal.instituciones as { nombre: string }[] | null)?.[0]?.nombre || 'Colegio Rafael Castillo';
        const urlApp = process.env.NEXT_PUBLIC_APP_URL || 'https://colegiorafaelcastillo.com';
        const emailHtml = generarHtmlCorreoRecuperacion({
          nombreUsuario: `${personal.nombres} ${personal.apellidos}`,
          codigoRestablecimiento: tempCode,
          nombreColegio,
          enlaceRestablecimiento: `${urlApp}/login`,
        });

        await resend.emails.send({
          from: `${nombreColegio} <soporte@aulascolegiorafaelcastillo.com>`,
          to: personal.correo,
          subject: 'Restablecer acceso — Asisto',
          html: emailHtml,
        }).catch((err) => {
          console.error('[recuperar] Error enviando email:', err);
        });
      } else {
        console.warn('[recuperar] RESEND_API_KEY no configurada. Email omitido.');
      }

      return NextResponse.json({
        ok: true,
        message: 'Código de restablecimiento temporal enviado por correo.'
      });
    }

    if (action === 'VIA_B') {
      if (!personalId) {
        return NextResponse.json({ error: 'ID de personal requerido' }, { status: 400 });
      }

      // Registrar solicitud digital al administrador
      const { error: dbErr } = await supabaseAdmin
        .from('personal')
        .update({
          solicita_restablecer: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', personalId);

      if (dbErr) {
        return NextResponse.json({ error: 'Error al enviar solicitud al administrador' }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Solicitud enviada al administrador exitosamente. Tu PIN será restablecido a 1234.'
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error del servidor' }, { status: 500 });
  }
}
