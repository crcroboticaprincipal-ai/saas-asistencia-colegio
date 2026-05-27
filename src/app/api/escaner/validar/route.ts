import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { qrCode, tipo } = await request.json();

    if (!qrCode || !tipo) {
      return NextResponse.json({ error: 'Datos insuficientes en la solicitud' }, { status: 400 });
    }

    const now = new Date();
    const fechaSQL = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const horaSQL = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Caracas',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(now);

    // ── 1. Buscar como ESTUDIANTE por qr_code o cédula ──
    const inputCleaned = qrCode.trim().toUpperCase().replace(/\s+/g, '');
    const { data: estudiante, error: estError } = await supabaseAdmin
      .from('estudiantes')
      .select('*')
      .or(`qr_code.eq.${inputCleaned},cedula.eq.${inputCleaned},cedula.eq.V-${inputCleaned},cedula.eq.E-${inputCleaned}`)
      .maybeSingle();

    if (!estError && estudiante) {
      if (estudiante.estado && estudiante.estado !== 'Activo') {
        return NextResponse.json({ error: '❌ Acceso Denegado: Estudiante Inactivo / Retirado' }, { status: 403 });
      }

      // Registrar en tabla asistencias
      const { error: errAsis } = await supabaseAdmin
        .from('asistencias')
        .insert([{
          estudiante_id: estudiante.id,
          tipo,
          fecha: fechaSQL,
          hora: horaSQL,
          institucion_id: estudiante.institucion_id,
        }]);

      if (errAsis) {
        return NextResponse.json({ error: 'Error al registrar asistencia del estudiante' }, { status: 500 });
      }

      // Notificar por correo de forma asíncrona (fire & forget)
      if (process.env.RESEND_API_KEY) {
        const horaLocal = now.toLocaleTimeString('es-VE', { hour12: true, timeZone: 'America/Caracas' });
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Colegio Rafael Castillo <notificaciones@aulascolegiorafaelcastillo.com>',
            to: estudiante.correo_representante,
            subject: `Notificación de ${tipo} - ${estudiante.nombre_completo}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
              <h2 style="color:#4f46e5;">UE Colegio Rafael Castillo</h2>
              <p>Estimado(a) <strong>${estudiante.nombre_representante}</strong>,</p>
              <p>El estudiante <strong>${estudiante.nombre_completo}</strong> ha registrado su <strong>${tipo}</strong> a las <strong>${horaLocal}</strong>.</p>
              <p style="color:#666;font-size:14px;">Mensaje automático del Sistema de Control de Asistencia.</p>
            </div>`,
          });
        } catch { /* Email falla silenciosamente */ }
      }

      return NextResponse.json({
        tipo_usuario: 'estudiante',
        nombre: estudiante.nombre_completo,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        estudiante_id: estudiante.id,
      });
    }

    // ── 2. Buscar como PERSONAL (el QR contiene el UUID del registro en personal) ──
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrCode);
    if (!isUUID) {
      return NextResponse.json({ error: 'Código QR no reconocido en el sistema' }, { status: 404 });
    }

    const { data: personal, error: perError } = await supabaseAdmin
      .from('personal')
      .select('*')
      .eq('id', qrCode)
      .maybeSingle();

    if (perError || !personal) {
      return NextResponse.json(
        { error: 'Código QR no pertenece a ningún estudiante ni empleado registrado' },
        { status: 404 }
      );
    }

    if (!personal.activo) {
      return NextResponse.json(
        { error: `${personal.nombres} ${personal.apellidos} está marcado como inactivo` },
        { status: 403 }
      );
    }

    // Registrar en tabla asistencia_personal
    const { error: errAsisPer } = await supabaseAdmin
      .from('asistencia_personal')
      .insert([{
        personal_id: personal.id,
        tipo,
        fecha: fechaSQL,
        hora: horaSQL,
        institucion_id: personal.institucion_id,
        estado_evaluacion: 'Sin Evaluar',
      }]);

    if (errAsisPer) {
      return NextResponse.json({ error: 'Error al registrar asistencia del empleado' }, { status: 500 });
    }

    return NextResponse.json({
      tipo_usuario: 'personal',
      personal_id: personal.id,
      nombre: `${personal.nombres} ${personal.apellidos}`,
      cargo: personal.cargo || personal.rol,
      rol: personal.rol,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
