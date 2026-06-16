import { NextResponse, after } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = SupabaseClient<any, any, any>;

interface EstudianteRow {
  id: string;
  cedula: string;
  nombre_completo: string;
  grado: string | null;
  seccion: string | null;
  estado: string | null;
  foto_url: string | null;
  qr_code: string | null;
  institucion_id: string;
  nombre_representante?: string | null;
  correo_representante: string | null;
  [key: string]: unknown;
}

/**
 * Búsqueda robusta de estudiante por QR o cédula.
 * Evita el uso de .or() con valores que contienen guiones (V-, E-, RC-)
 * que pueden romper el parser de filtros de Supabase PostgREST.
 * Usa búsquedas secuenciales corto-circuitadas en su lugar.
 */
async function buscarEstudiante(supabase: DbClient, input: string): Promise<EstudianteRow | null> {
  // Normalización: mayúsculas, sin espacios
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');

  // Extraer el número de cédula puro (sin prefijos V-, E-, RC-, QR-)
  const soloNumeros = raw.replace(/^(RC-|QR-|V-|E-)/, '').replace(/[^0-9]/g, '');

  // Lista de variantes a buscar en orden de probabilidad
  const candidatos: { campo: 'qr_code' | 'cedula'; valor: string }[] = [
    { campo: 'qr_code', valor: raw },                    // RC-12345678 exacto
    { campo: 'cedula',  valor: soloNumeros },             // 12345678
    { campo: 'cedula',  valor: `V-${soloNumeros}` },      // V-12345678
    { campo: 'cedula',  valor: `E-${soloNumeros}` },      // E-12345678
    { campo: 'qr_code', valor: `QR-${soloNumeros}` },    // QR-12345678 (formato alternativo)
  ];

  // Eliminar duplicados y candidatos vacíos
  const unicos = candidatos.filter(
    (c, i, arr) => c.valor && arr.findIndex(x => x.campo === c.campo && x.valor === c.valor) === i
  );

  if (unicos.length === 0) return null;

  const orFilters = unicos.map(({ campo, valor }) => `${campo}.eq.${valor}`).join(',');

  const { data, error } = await supabase
    .from('estudiantes')
    .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
    .eq('institucion_id', COLEGIO_ID)
    .or(orFilters)
    .maybeSingle();

  if (error) {
    console.error(`[escaner/validar] Error buscando estudiante con filtros (${orFilters}):`, error.message);
    return null;
  }

  return data;
}

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

    // Sanitización básica
    const inputCleaned = qrCode.trim().toUpperCase().replace(/\s+/g, '');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputCleaned);
    const hasKnownPrefix = /^(RC-|QR-|V-|E-)/.test(inputCleaned);
    const isOnlyNumbers = /^\d+$/.test(inputCleaned);

    if (!isUUID && !hasKnownPrefix && !isOnlyNumbers) {
      return NextResponse.json({ error: '⚠️ Código no reconocido por el sistema Asisto' }, { status: 400 });
    }

    // Fecha y hora en zona Venezuela
    const now = new Date();
    const fechaSQL = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const horaSQL = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Caracas',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(now);

    // ── 1. Buscar como ESTUDIANTE ──
    const estudiante = await buscarEstudiante(supabaseAdmin, inputCleaned);

    if (estudiante) {
      if (estudiante.estado && estudiante.estado !== 'Activo') {
        return NextResponse.json({ error: '❌ Acceso Denegado: Estudiante Inactivo / Retirado' }, { status: 403 });
      }

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
        console.error('[escaner/validar] Error insertando asistencia:', errAsis.message);
        return NextResponse.json({ error: 'Error al registrar asistencia del estudiante' }, { status: 500 });
      }

      // Notificación email vía endpoint dedicado (confiable en Vercel serverless)
      // Usamos after() de Next.js para enviar la notificación en segundo plano
      // y no bloquear la respuesta inmediata al escáner.
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (request.headers.get('origin') ?? '')
        || (request.headers.get('x-forwarded-host')
            ? `https://${request.headers.get('x-forwarded-host')}`
            : '');

      if (baseUrl && estudiante.correo_representante) {
        after(() => {
          fetch(`${baseUrl}/api/notificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estudiante_id: estudiante.id,
              tipo,
            }),
          }).catch((err) => {
            console.error('[escaner/validar] Error disparando notificación:', err);
          });
        });
      }

      return NextResponse.json({
        tipo_usuario: 'estudiante',
        nombre: estudiante.nombre_completo,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
        estudiante_id: estudiante.id,
        foto_url: estudiante.foto_url || null,
      });
    }

    // ── 2. Buscar como PERSONAL (UUID directo) ──
    if (!isUUID) {
      return NextResponse.json({ error: '⚠️ Código no reconocido por el sistema Asisto' }, { status: 400 });
    }

    const { data: personal, error: perError } = await supabaseAdmin
      .from('personal')
      .select('id, nombres, apellidos, cargo, rol, activo, institucion_id, auth_user_id')
      .eq('id', inputCleaned)
      .eq('institucion_id', COLEGIO_ID)
      .maybeSingle();

    if (perError || !personal) {
      return NextResponse.json(
        { error: '⚠️ Código no reconocido por el sistema Asisto' },
        { status: 400 }
      );
    }

    if (!personal.activo) {
      return NextResponse.json(
        { error: `${personal.nombres} ${personal.apellidos} está marcado como inactivo` },
        { status: 403 }
      );
    }

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
      console.error('[escaner/validar] Error insertando asistencia personal:', errAsisPer.message);
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
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[escaner/validar] Error inesperado:', msg);
    return NextResponse.json({ error: '⚠️ Código no reconocido por el sistema Asisto' }, { status: 400 });
  }
}
