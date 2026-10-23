import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, resolveInstitucion } from '@/lib/api-auth';
import type { TipoPase } from '@/lib/supabase/types';

export async function POST(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = (await request.json()) as {
      qrCode?: string;
      tipo_pase?: TipoPase;
      motivo?: string;
      institucion_id?: string;
    };

    const { qrCode, tipo_pase, motivo } = body;

    if (!qrCode || !tipo_pase) {
      return NextResponse.json({ error: 'Datos insuficientes' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, body.institucion_id);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    // Hora actual en Venezuela
    const now = new Date();
    const fechaSQL = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const horaSQL = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Caracas',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);

    const diaSemanaVE = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Caracas' }),
    ).getDay();

    const inputCleaned = qrCode.trim().toUpperCase().replace(/\s+/g, '');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputCleaned);
    const hasAsistoPrefix = /^(ASISTO-|RC-|QR-|V-|E-)/.test(inputCleaned);
    const isOnlyNumbers = /^\d+$/.test(inputCleaned);
    const isAlphanumericCode = /^[A-Z0-9_\-]+$/i.test(inputCleaned);

    if (!isUUID && !hasAsistoPrefix && !isOnlyNumbers && !isAlphanumericCode) {
      return NextResponse.json({ error: '⚠️ Código no reconocido por el sistema Asisto' }, { status: 400 });
    }

    let estudiante = null;

    // Búsqueda del estudiante respetando el institucion_id de la sesión
    const applyInst = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
      institucionId ? q.eq('institucion_id', institucionId) : q;

    let resEst = supabaseAdmin
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id')
      .or(`qr_code.eq.${inputCleaned},cedula.eq.${inputCleaned},cedula.eq.V-${inputCleaned},cedula.eq.E-${inputCleaned}`);
    resEst = applyInst(resEst);

    const { data: estData } = await resEst.maybeSingle();
    estudiante = estData;

    // Fallback por Cédula limpia
    if (!estudiante) {
      const cedulaExtraida = inputCleaned.replace(/^(ASISTO-|RC-|QR-|V-|E-)/, '').replace(/[^0-9]/g, '');
      if (cedulaExtraida) {
        let resFallback = supabaseAdmin
          .from('estudiantes')
          .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id')
          .or(`cedula.eq.${cedulaExtraida},cedula.eq.V-${cedulaExtraida},cedula.eq.E-${cedulaExtraida},cedula.ilike.${cedulaExtraida}-H%`);
        resFallback = applyInst(resFallback);

        const { data: estFallback } = await resFallback.limit(1);
        if (estFallback && estFallback.length > 0) estudiante = estFallback[0];
      }
    }

    if (!estudiante) {
      return NextResponse.json({ error: '⚠️ Estudiante no encontrado o no pertenece a esta institución' }, { status: 404 });
    }

    if (estudiante.estado !== 'Activo') {
      return NextResponse.json({ error: '❌ Estudiante Inactivo / Retirado' }, { status: 403 });
    }

    // Buscar asignación de profesor activo en este horario
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
      .lte('hora_inicio', horaSQL)
      .gte('hora_fin', horaSQL)
      .maybeSingle();

    const { data: pase, error: paseError } = await supabaseAdmin
      .from('pases')
      .insert([
        {
          institucion_id: estudiante.institucion_id,
          estudiante_id: estudiante.id,
          tipo_pase,
          motivo: motivo ? motivo.trim() : null,
          hora_pase: horaSQL,
          fecha: fechaSQL,
          profesor_notificado_id: asignacion?.personal_id || null,
          asignacion_id: asignacion?.id || null,
          notificacion_enviada: false,
        },
      ])
      .select('id')
      .single();

    if (paseError) {
      return NextResponse.json({ error: 'Error al registrar pase' }, { status: 500 });
    }

    if (asignacion?.personal_id) {
      const tipoPaseLabel =
        tipo_pase === 'ENTRADA'
          ? 'Pase de Entrada'
          : tipo_pase === 'SALIDA'
            ? 'Pase de Salida'
            : 'Pase Especial';

      const mensaje = `📋 ${tipoPaseLabel}: ${estudiante.nombre_completo} (${estudiante.grado} "${estudiante.seccion}") a las ${horaSQL.substring(0, 5)}${motivo ? ` — Motivo: ${motivo}` : ''}`;

      await supabaseAdmin.from('notificaciones_profesor').insert([
        {
          institucion_id: estudiante.institucion_id,
          personal_id: asignacion.personal_id,
          pase_id: pase.id,
          mensaje,
          leida: false,
        },
      ]);

      await supabaseAdmin
        .from('pases')
        .update({ notificacion_enviada: true })
        .eq('id', pase.id);
    }

    type PersonalJoin = { nombres: string; apellidos: string; correo: string | null } | null;
    const profe = asignacion?.personal as PersonalJoin | undefined;
    const profesorInfo = asignacion
      ? {
          id: asignacion.personal_id,
          nombre: profe ? `${profe.nombres} ${profe.apellidos}` : 'Profesor',
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
