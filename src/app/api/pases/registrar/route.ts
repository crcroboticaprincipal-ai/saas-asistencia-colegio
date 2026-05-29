import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TipoPase } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { qrCode, tipo_pase, motivo } = await request.json() as {
      qrCode: string;
      tipo_pase: TipoPase;
      motivo?: string;
    };

    if (!qrCode || !tipo_pase) {
      return NextResponse.json({ error: 'Datos insuficientes' }, { status: 400 });
    }

    // Hora actual en Venezuela
    const now = new Date();
    const fechaSQL = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const horaSQL = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Caracas',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(now);

    // día de semana en Venezuela (0=Domingo, 1=Lunes, ... 6=Sábado)
    const diaSemanaVE = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Caracas' })
    ).getDay();

    // Buscar estudiante
    const inputCleaned = qrCode.trim().toUpperCase().replace(/\s+/g, '');
    const { data: estudiante, error: estError } = await supabaseAdmin
      .from('estudiantes')
      .select('*')
      .or(`qr_code.eq.${inputCleaned},cedula.eq.${inputCleaned},cedula.eq.V-${inputCleaned},cedula.eq.E-${inputCleaned}`)
      .maybeSingle();

    if (estError || !estudiante) {
      return NextResponse.json({ error: 'Estudiante no encontrado en el sistema' }, { status: 404 });
    }

    if (estudiante.estado !== 'Activo') {
      return NextResponse.json({ error: '❌ Estudiante Inactivo / Retirado' }, { status: 403 });
    }

    // Buscar asignación activa del profesor para este bloque horario
    const horaActual = horaSQL; // HH:MM:SS
    const { data: asignacion } = await supabaseAdmin
      .from('profesores_asignaciones')
      .select(`
        id,
        personal_id,
        materia_id,
        grado,
        seccion,
        hora_inicio,
        hora_fin,
        personal (id, nombres, apellidos, correo)
      `)
      .eq('institucion_id', estudiante.institucion_id)
      .eq('grado', estudiante.grado)
      .eq('seccion', estudiante.seccion)
      .eq('activo', true)
      .eq('dia_semana', diaSemanaVE)
      .lte('hora_inicio', horaActual)
      .gte('hora_fin', horaActual)
      .maybeSingle();

    // Registrar el pase
    const { data: pase, error: paseError } = await supabaseAdmin
      .from('pases')
      .insert([{
        institucion_id: estudiante.institucion_id,
        estudiante_id: estudiante.id,
        tipo_pase,
        motivo: motivo || null,
        hora_pase: horaSQL,
        fecha: fechaSQL,
        profesor_notificado_id: asignacion?.personal_id || null,
        asignacion_id: asignacion?.id || null,
        notificacion_enviada: false,
      }])
      .select('id')
      .single();

    if (paseError) {
      return NextResponse.json({ error: 'Error al registrar pase' }, { status: 500 });
    }

    // Si hay profesor activo, crear notificación
    if (asignacion?.personal_id) {
      const tipoPaseLabel = tipo_pase === 'ENTRADA' ? 'Pase de Entrada'
        : tipo_pase === 'SALIDA' ? 'Pase de Salida'
        : 'Pase Especial';

      const mensaje = `📋 ${tipoPaseLabel}: ${estudiante.nombre_completo} (${estudiante.grado} "${estudiante.seccion}") a las ${horaSQL.substring(0, 5)}${motivo ? ` — Motivo: ${motivo}` : ''}`;

      await supabaseAdmin
        .from('notificaciones_profesor')
        .insert([{
          institucion_id: estudiante.institucion_id,
          personal_id: asignacion.personal_id,
          pase_id: pase.id,
          mensaje,
          leida: false,
        }]);

      // Actualizar pase como notificado
      await supabaseAdmin
        .from('pases')
        .update({ notificacion_enviada: true })
        .eq('id', pase.id);
    }

    const profesorInfo = asignacion
      ? {
          id: asignacion.personal_id,
          nombre: `${(asignacion.personal as any)?.nombres} ${(asignacion.personal as any)?.apellidos}`,
          notificado: true,
        }
      : null;

    return NextResponse.json({
      success: true,
      pase_id: pase.id,
      estudiante: {
        nombre: estudiante.nombre_completo,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        foto_url: estudiante.foto_url || null,
      },
      profesor_notificado: profesorInfo,
      tipo_pase,
      motivo: motivo || null,
      hora: horaSQL,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
