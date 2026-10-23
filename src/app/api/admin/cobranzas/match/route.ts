import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

interface FilaEntrante {
  nombre_estudiante: string;
  nombre_representante?: string;
  seccion: string;
  deuda_dolares: number | string;
  mes_vencido: string;
  mora?: number | string;
}

function normalizarTexto(txt: string | null | undefined): string {
  if (!txt) return '';
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMonto(val: number | string | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  const clean = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, num);
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const { filas, institucion_id } = body as { filas?: FilaEntrante[]; institucion_id?: string };

    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas para procesar' }, { status: 400 });
    }

    if (filas.length > 1000) {
      return NextResponse.json({ error: 'Límite de 1000 registros por archivo' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;

    if (!targetInstitucionId) {
      return NextResponse.json({ error: 'Institución obligatoria' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Consultar todos los estudiantes activos del plantel
    const { data: estudiantes, error: errEst } = await sb
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, nombre_representante, correo_representante, foto_url')
      .eq('institucion_id', targetInstitucionId)
      .eq('estado', 'Activo');

    if (errEst) throw new Error(errEst.message);

    const listaEstudiantes = estudiantes || [];

    // Pre-indexar estudiantes normalizados
    const estudiantesIndexados = listaEstudiantes.map((e) => ({
      raw: e,
      normNombre: normalizarTexto(e.nombre_completo),
      tokensNombre: normalizarTexto(e.nombre_completo).split(' ').filter((t) => t.length > 1),
      normSeccion: normalizarTexto(e.seccion),
      normGrado: normalizarTexto(e.grado),
    }));

    let montoGlobalTotal = 0;

    const filasProcesadas = filas.map((fila, index) => {
      const nombreNorm = normalizarTexto(fila.nombre_estudiante);
      const seccionNorm = normalizarTexto(fila.seccion);
      const tokensFila = nombreNorm.split(' ').filter((t) => t.length > 1);

      const deuda = parseMonto(fila.deuda_dolares);
      const mora = parseMonto(fila.mora);
      const total = deuda + mora;
      montoGlobalTotal += total;

      // 1. Intento de match exacto: nombre idéntico
      let match = estudiantesIndexados.find((e) => {
        const nombreExacto = e.normNombre === nombreNorm;
        if (!nombreExacto) return false;
        if (!seccionNorm) return true;
        return (
          e.normSeccion === seccionNorm ||
          e.normSeccion.includes(seccionNorm) ||
          seccionNorm.includes(e.normSeccion) ||
          e.normGrado.includes(seccionNorm)
        );
      });

      // 2. Si no hubo match exacto, coincidencia por tokens principales de nombre y sección
      if (!match && tokensFila.length >= 2) {
        match = estudiantesIndexados.find((e) => {
          const coincidenciasTokens = tokensFila.filter((tok) => e.tokensNombre.includes(tok));
          // Al menos 2 tokens significativos coincidentes
          const tokenMatch = coincidenciasTokens.length >= Math.min(2, tokensFila.length);
          if (!tokenMatch) return false;

          if (!seccionNorm) return true;
          return (
            e.normSeccion === seccionNorm ||
            e.normSeccion.includes(seccionNorm) ||
            seccionNorm.includes(e.normSeccion) ||
            e.normGrado.includes(seccionNorm)
          );
        });
      }

      // 3. Intento de match por nombre sin filtro estricto de sección si solo hay uno en toda la BD
      if (!match) {
        const matchesNombre = estudiantesIndexados.filter((e) => {
          if (e.normNombre === nombreNorm) return true;
          const coincidencias = tokensFila.filter((tok) => e.tokensNombre.includes(tok));
          return coincidencias.length >= 2 && coincidencias.length === tokensFila.length;
        });
        if (matchesNombre.length === 1) {
          match = matchesNombre[0];
        }
      }

      const mesVencido = fila.mes_vencido?.trim() || 'Mensualidad Escolar';
      const nombreRepresentanteFila = fila.nombre_representante?.trim();

      if (match) {
        const correoRegistrado = match.raw.correo_representante?.trim() || '';
        const tieneCorreoValido = Boolean(correoRegistrado && correoRegistrado.includes('@'));

        return {
          idx: index,
          estado: tieneCorreoValido ? ('listo' as const) : ('sin_correo' as const),
          estudiante_id: match.raw.id,
          cedula: match.raw.cedula,
          nombre_estudiante: match.raw.nombre_completo,
          nombre_archivo: fila.nombre_estudiante,
          grado: match.raw.grado,
          seccion: match.raw.seccion,
          seccion_archivo: fila.seccion,
          nombre_representante: match.raw.nombre_representante || nombreRepresentanteFila || 'Representante',
          correo_representante: correoRegistrado,
          deuda_dolares: deuda,
          mora_dolares: mora,
          total_dolares: total,
          mes_vencido: mesVencido,
          foto_url: match.raw.foto_url,
        };
      }

      return {
        idx: index,
        estado: 'no_encontrado' as const,
        estudiante_id: null,
        cedula: null,
        nombre_estudiante: fila.nombre_estudiante,
        nombre_archivo: fila.nombre_estudiante,
        grado: '',
        seccion: fila.seccion,
        seccion_archivo: fila.seccion,
        nombre_representante: nombreRepresentanteFila || 'Representante',
        correo_representante: '',
        deuda_dolares: deuda,
        mora_dolares: mora,
        total_dolares: total,
        mes_vencido: mesVencido,
        foto_url: null,
      };
    });

    const totalListos = filasProcesadas.filter((f) => f.estado === 'listo').length;
    const totalSinCorreo = filasProcesadas.filter((f) => f.estado === 'sin_correo').length;
    const totalNoEncontrados = filasProcesadas.filter((f) => f.estado === 'no_encontrado').length;

    return NextResponse.json({
      ok: true,
      resumen: {
        totalFilas: filas.length,
        totalListos,
        totalSinCorreo,
        totalNoEncontrados,
        montoGlobalTotal,
      },
      filas: filasProcesadas,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar archivo';
    console.error('[cobranzas/match] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
