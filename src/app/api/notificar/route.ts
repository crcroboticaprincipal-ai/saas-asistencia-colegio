import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Este endpoint SOLO envía el correo de notificación.
// El registro de asistencia ya fue hecho por /api/escaner/validar.
export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('[notificar] RESEND_API_KEY no configurada. Email omitido.');
      return NextResponse.json({ ok: false, message: 'RESEND_API_KEY no configurada' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { estudiante_id, tipo } = await request.json();

    if (!estudiante_id || !tipo) {
      return NextResponse.json({ error: 'Faltan datos: estudiante_id y tipo son requeridos' }, { status: 400 });
    }

    // 1. Obtener datos del estudiante
    const { data: estudiante, error: errEst } = await supabase
      .from('estudiantes')
      .select('id, nombre_completo, cedula, grado, seccion, correo_representante, nombre_representante, foto_url, institucion_id')
      .eq('id', estudiante_id)
      .maybeSingle();

    if (errEst || !estudiante) {
      console.error('[notificar] Estudiante no encontrado:', errEst?.message);
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
    }

    if (!estudiante.correo_representante) {
      return NextResponse.json({ ok: false, message: 'Sin correo de representante registrado' });
    }

    // 2. Obtener nombre de la institución
    const { data: institucion } = await supabase
      .from('instituciones')
      .select('nombre')
      .eq('id', estudiante.institucion_id)
      .maybeSingle();

    const nombreColegio = institucion?.nombre || 'Colegio Rafael Castillo';

    // 3. Hora local Venezuela
    const now = new Date();
    const horaLocal = now.toLocaleTimeString('es-VE', {
      hour12: true,
      timeZone: 'America/Caracas',
    });

    // 4. Generar HTML del correo
    const { generarHtmlCorreoAsistencia } = await import('@/lib/email');
    const emailHtml = generarHtmlCorreoAsistencia({
      nombreRepresentante: estudiante.nombre_representante ?? '',
      nombreEstudiante: estudiante.nombre_completo ?? '',
      tipo,
      horaLocal,
      fotoUrl: estudiante.foto_url,
      nombreColegio,
      grado: estudiante.grado || '',
      seccion: estudiante.seccion || '',
    });

    // 5. Enviar con Resend
    const resend = new Resend(resendApiKey);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${nombreColegio} <notificaciones@aulascolegiorafaelcastillo.com>`,
      to: estudiante.correo_representante,
      subject: `Notificación de ${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} — ${estudiante.nombre_completo}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('[notificar] Error Resend:', emailError);
      return NextResponse.json({ ok: false, error: emailError.message }, { status: 500 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info(`[notificar] ✅ Email enviado a ${estudiante.correo_representante} | id=${emailData?.id}`);
    }
    return NextResponse.json({ ok: true, emailId: emailData?.id });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[notificar] Error inesperado:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
