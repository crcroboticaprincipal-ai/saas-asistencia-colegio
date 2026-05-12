import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { estudiante_id, tipo } = await request.json();

    if (!estudiante_id || !tipo) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 1. Obtener datos del estudiante
    const { data: estudiante, error: errorEstudiante } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('id', estudiante_id)
      .single();

    if (errorEstudiante || !estudiante) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
    }

    // 2. Registrar Asistencia
    const horaLocal = new Date().toLocaleTimeString('es-VE', { hour12: true, timeZone: 'America/Caracas' });
    
    const { error: errorAsistencia } = await supabase
      .from('asistencias')
      .insert([
        { 
          estudiante_id, 
          tipo, 
          // fecha y hora son manejadas por la DB como default, pero podemos enviarlas o dejar que la db lo haga
        }
      ]);

    if (errorAsistencia) {
      return NextResponse.json({ error: 'Error al guardar la asistencia' }, { status: 500 });
    }

    // 3. Enviar correo vía Resend
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      try {
        await resend.emails.send({
          from: 'Colegio Rafael Castillo <notificaciones@aulascolegiorafaelcastillo.com>',
          to: estudiante.correo_representante,
          subject: `Notificación de ${tipo} - ${estudiante.nombre_completo}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #4f46e5; margin: 0;">UE Colegio Rafael Castillo</h2>
              </div>
              <p>Estimado(a) <strong>${estudiante.nombre_representante}</strong>,</p>
              <p>Le informamos que el estudiante <strong>${estudiante.nombre_completo}</strong> ha registrado su <strong>${tipo}</strong> en las instalaciones del colegio a las <strong>${horaLocal}</strong>.</p>
              <br/>
              <p style="color: #666; font-size: 14px;">Este es un mensaje automático del Sistema de Control de Asistencia.</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Error enviando email, pero la asistencia se registró:", emailError);
      }
    } else {
      console.warn("No RESEND_API_KEY set. Email skipped.");
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
