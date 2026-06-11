import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('[notificar/expo] RESEND_API_KEY no configurada.');
      return NextResponse.json({ error: 'RESEND_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    const { nombre, correo, tipo } = await request.json();

    if (!nombre || !correo) {
      return NextResponse.json({ error: 'Nombre y correo son requeridos' }, { status: 400 });
    }

    const now = new Date();
    const horaLocal = now.toLocaleTimeString('es-VE', {
      hour12: true,
      timeZone: 'America/Caracas',
    });

    // Cargar la plantilla institucional de Asisto
    const { generarHtmlCorreoAsistencia } = await import('@/lib/email');
    const emailHtml = generarHtmlCorreoAsistencia({
      nombreRepresentante: nombre,
      nombreEstudiante: nombre,
      tipo: tipo || 'ENTRADA',
      horaLocal,
      nombreColegio: 'Colegio Rafael Castillo (Expo 2026)',
      grado: 'Visitante de Stand',
      seccion: 'Expo-Innovación',
    });

    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: 'Asisto Expo <notificaciones@aulascolegiorafaelcastillo.com>',
      to: correo.trim(),
      subject: `Notificación de Demo (${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}) — ${nombre}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[notificar/expo] Error Resend:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[notificar/expo] Email real enviado a ${correo} para ${nombre}`);
    return NextResponse.json({ ok: true, emailId: data?.id });

  } catch (error: any) {
    const msg = error.message || 'Error interno';
    console.error('[notificar/expo] Error inesperado:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
