import { NextResponse, after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession } from '@/lib/api-auth';
import { enviarCorreoAsistencia } from '@/lib/email';

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
}

interface PersonalRow {
  id: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  rol: string | null;
  activo: boolean;
  institucion_id: string;
}

async function buscarEstudiante(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: string,
  institucionId: string | null,
): Promise<EstudianteRow | null> {
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');
  const soloNumeros = raw.replace(/^(RC-|QR-|V-|E-|ASISTO-)/, '').replace(/[^0-9]/g, '');

  const applyInstFilter = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
    institucionId ? q.eq('institucion_id', institucionId) : q;

  // 1. Buscar por qr_code exacto
  if (raw) {
    let query = supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
      .eq('qr_code', raw);
    query = applyInstFilter(query);
    const { data: estByQr } = await query.maybeSingle();
    if (estByQr) return estByQr as EstudianteRow;

    // 1.5 Cédula exacta
    let queryCed = supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
      .eq('cedula', raw);
    queryCed = applyInstFilter(queryCed);
    const { data: estByCedExact } = await queryCed.maybeSingle();
    if (estByCedExact) return estByCedExact as EstudianteRow;
  }

  // 2. Buscar por cédula limpia (sólo números)
  if (soloNumeros) {
    let queryClean = supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
      .eq('cedula', soloNumeros);
    queryClean = applyInstFilter(queryClean);
    const { data: estByCed } = await queryClean.maybeSingle();
    if (estByCed) return estByCed as EstudianteRow;

    // Cédula con sufijo hermano (-H1, -H2)
    let queryHermano = supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
      .ilike('cedula', `${soloNumeros}-H%`);
    queryHermano = applyInstFilter(queryHermano);
    const { data: estsHermano } = await queryHermano.limit(1);
    if (estsHermano && estsHermano.length > 0) return estsHermano[0] as EstudianteRow;

    // Prefijo V- / E- / QR-
    for (const prefix of ['V-', 'E-', 'QR-']) {
      const field = prefix === 'QR-' ? 'qr_code' : 'cedula';
      let q = supabase
        .from('estudiantes')
        .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante')
        .eq(field, `${prefix}${soloNumeros}`);
      q = applyInstFilter(q);
      const { data } = await q.maybeSingle();
      if (data) return data as EstudianteRow;
    }
  }

  // 3. Búsqueda inteligente por nombre
  const palabras = input.trim().split(/\s+/).filter((p) => p.length > 1);
  if (palabras.length > 0) {
    let queryName = supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, estado, foto_url, qr_code, institucion_id, nombre_representante, correo_representante');
    queryName = applyInstFilter(queryName);

    for (const pal of palabras) {
      const pattern = pal
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[AEIOUN]/g, '_');
      queryName = queryName.ilike('nombre_completo', `%${pattern}%`);
    }

    const { data: estByNombre } = await queryName.limit(1);
    if (estByNombre && estByNombre.length > 0) return estByNombre[0] as EstudianteRow;
  }

  return null;
}

async function buscarPersonal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: string,
  soloNumeros: string,
  institucionId: string | null,
): Promise<PersonalRow | null> {
  const applyInstFilter = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
    institucionId ? q.eq('institucion_id', institucionId) : q;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
  if (isUUID) {
    let q = supabase.from('personal').select('id, nombres, apellidos, cargo, rol, activo, institucion_id').eq('id', input);
    q = applyInstFilter(q);
    const { data } = await q.maybeSingle();
    if (data) return data as PersonalRow;
  }

  if (soloNumeros) {
    for (const val of [soloNumeros, `V-${soloNumeros}`, `E-${soloNumeros}`]) {
      let q = supabase.from('personal').select('id, nombres, apellidos, cargo, rol, activo, institucion_id').eq('cedula', val);
      q = applyInstFilter(q);
      const { data } = await q.maybeSingle();
      if (data) return data as PersonalRow;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { qrCode, tipo, evento_id } = body as { qrCode?: string; tipo?: string; evento_id?: string };

    if (!qrCode || !tipo || !['ENTRADA', 'SALIDA'].includes(tipo.toUpperCase())) {
      return NextResponse.json({ error: 'Datos insuficientes o tipo de evento inválido' }, { status: 400 });
    }

    const tipoNormalizado = tipo.toUpperCase() as 'ENTRADA' | 'SALIDA';
    const inputCleaned = qrCode.trim().toUpperCase().replace(/\s+/g, '');
    const soloNumeros = inputCleaned.replace(/^(ASISTO-|RC-|QR-|V-|E-)/, '').replace(/[^0-9]/g, '');

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

    // Institución efectiva (si la sesión es de personal/admin restringido)
    const instId = session.inst;

    // ── 1. Buscar como ESTUDIANTE ──
    const estudiante = await buscarEstudiante(supabaseAdmin, inputCleaned, instId);

    if (estudiante) {
      if (estudiante.estado && estudiante.estado !== 'Activo') {
        return NextResponse.json({ error: '❌ Acceso Denegado: Estudiante Inactivo / Retirado' }, { status: 403 });
      }

      // Control de Idempotencia: evitar duplicados en un margen de 30 segundos
      const { data: recReciente } = await supabaseAdmin
        .from('asistencias')
        .select('id, hora')
        .eq('estudiante_id', estudiante.id)
        .eq('tipo', tipoNormalizado)
        .eq('fecha', fechaSQL)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recReciente?.hora) {
        const [h1, m1, s1] = recReciente.hora.split(':').map(Number);
        const [h2, m2, s2] = horaSQL.split(':').map(Number);
        const diffSec = Math.abs((h2 * 3600 + m2 * 60 + s2) - (h1 * 3600 + m1 * 60 + s1));
        if (diffSec < 30) {
          // Asistencia recién procesada (idempotencia)
          return NextResponse.json({
            tipo_usuario: 'estudiante',
            nombre: estudiante.nombre_completo,
            grado: estudiante.grado,
            seccion: estudiante.seccion,
            estudiante_id: estudiante.id,
            foto_url: estudiante.foto_url || null,
            idempotente: true,
          });
        }
      }

      const { error: errAsis } = await supabaseAdmin.from('asistencias').insert([
        {
          estudiante_id: estudiante.id,
          tipo: tipoNormalizado,
          fecha: fechaSQL,
          hora: horaSQL,
          institucion_id: estudiante.institucion_id,
        },
      ]);

      if (errAsis) {
        console.error('[escaner/validar] Error insertando asistencia:', errAsis.message);
        return NextResponse.json({ error: 'Error al registrar asistencia del estudiante' }, { status: 500 });
      }

      if (estudiante.correo_representante) {
        after(async () => {
          try {
            await enviarCorreoAsistencia({
              estudianteId: estudiante.id,
              tipo: tipoNormalizado,
            });
          } catch (err) {
            console.error('[escaner/validar] Error enviando correo:', err);
          }
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

    // ── 2. Buscar como PERSONAL ──
    const personal = await buscarPersonal(supabaseAdmin, inputCleaned, soloNumeros, instId);

    if (!personal) {
      return NextResponse.json({ error: '⚠️ Código no reconocido por el sistema Asisto' }, { status: 400 });
    }

    if (!personal.activo) {
      return NextResponse.json(
        { error: `${personal.nombres} ${personal.apellidos} está marcado como inactivo` },
        { status: 403 },
      );
    }

    // Idempotencia personal (30s)
    const { data: recPerReciente } = await supabaseAdmin
      .from('asistencia_personal')
      .select('id, hora')
      .eq('personal_id', personal.id)
      .eq('tipo', tipoNormalizado)
      .eq('fecha', fechaSQL)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recPerReciente?.hora) {
      const [h1, m1, s1] = recPerReciente.hora.split(':').map(Number);
      const [h2, m2, s2] = horaSQL.split(':').map(Number);
      const diffSec = Math.abs((h2 * 3600 + m2 * 60 + s2) - (h1 * 3600 + m1 * 60 + s1));
      if (diffSec < 30) {
        return NextResponse.json({
          tipo_usuario: 'personal',
          personal_id: personal.id,
          nombre: `${personal.nombres} ${personal.apellidos}`,
          cargo: personal.cargo || personal.rol,
          rol: personal.rol,
          idempotente: true,
        });
      }
    }

    const { error: errAsisPer } = await supabaseAdmin.from('asistencia_personal').insert([
      {
        personal_id: personal.id,
        tipo: tipoNormalizado,
        fecha: fechaSQL,
        hora: horaSQL,
        institucion_id: personal.institucion_id,
        estado_evaluacion: 'Sin Evaluar',
      },
    ]);

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
