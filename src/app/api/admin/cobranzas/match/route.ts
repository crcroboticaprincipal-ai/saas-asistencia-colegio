import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { normalizarGrado, esSeccionValida, SECCIONES } from '@/lib/grados-catalogo';

interface FilaEntrante {
  cedula?: string;
  nombre_estudiante: string;
  nombre_representante?: string;
  correo_representante?: string;
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

function slugifyNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanBaseCedula(c: string | null | undefined): string {
  if (!c) return '';
  return String(c)
    .trim()
    .toUpperCase()
    .replace(/-H\d+$/i, '')
    .replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '')
    .replace(/[^0-9A-Z]/g, '');
}

/**
 * Extrae grado y sección de una cadena como "1er Grado A", "3er Año B", "Inicial B", "A", etc.
 */
function extraerGradoYSeccion(texto: string): { grado: string; seccion: string } {
  if (!texto) return { grado: '1er Grado', seccion: 'A' };
  const limpio = texto.trim();

  // Si termina con una letra de sección (A, B, C) precedida de espacio o guion
  const matchSeccion = limpio.match(/^(.*?)(?:[\s\-_]+)([A-C])$/i);
  if (matchSeccion) {
    const gradoTexto = matchSeccion[1].trim();
    const posibleGrado = normalizarGrado(gradoTexto) ?? gradoTexto;
    const seccionFinal = matchSeccion[2].toUpperCase();
    return {
      grado: String(posibleGrado || '1er Grado'),
      seccion: esSeccionValida(seccionFinal) ? seccionFinal : 'A',
    };
  }

  // Si solo viene "A", "B" o "C"
  if (/^[A-C]$/i.test(limpio)) {
    return { grado: '1er Grado', seccion: limpio.toUpperCase() };
  }

  // Si es un nombre de grado canónico
  const norm = normalizarGrado(limpio);
  return {
    grado: String(norm || limpio),
    seccion: 'A',
  };
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

    // 1. Consultar todos los estudiantes activos del plantel
    const { data: estudiantes, error: errEst } = await sb
      .from('estudiantes')
      .select('id, cedula, nombre_completo, grado, seccion, nombre_representante, correo_representante, foto_url')
      .eq('institucion_id', targetInstitucionId)
      .eq('estado', 'Activo');

    if (errEst) throw new Error(errEst.message);

    const listaEstudiantes = estudiantes || [];

    // Pre-indexar estudiantes para coincidencia rápida
    const estudiantesIndexados = listaEstudiantes.map((e) => ({
      raw: e,
      baseCedula: cleanBaseCedula(e.cedula),
      normNombre: normalizarTexto(e.nombre_completo),
      tokensNombre: normalizarTexto(e.nombre_completo).split(' ').filter((t) => t.length > 1),
      normSeccion: normalizarTexto(e.seccion),
      normGrado: normalizarTexto(e.grado),
    }));

    let montoGlobalTotal = 0;
    let totalNuevosRegistrados = 0;

    const filasProcesadas = [];

    for (let index = 0; index < filas.length; index++) {
      const fila = filas[index];
      const nombreNorm = normalizarTexto(fila.nombre_estudiante);
      const seccionNorm = normalizarTexto(fila.seccion);
      const tokensFila = nombreNorm.split(' ').filter((t) => t.length > 1);
      const filaCedulaBase = cleanBaseCedula(fila.cedula);

      const deuda = parseMonto(fila.deuda_dolares);
      const mora = parseMonto(fila.mora);
      const total = deuda + mora;
      montoGlobalTotal += total;

      let match: (typeof estudiantesIndexados)[number] | null = null;

      // ── INTENTO 1: Coincidencia por Cédula (si viene en el archivo) ──
      if (filaCedulaBase) {
        const matchesPorCedula = estudiantesIndexados.filter((e) => e.baseCedula === filaCedulaBase);
        if (matchesPorCedula.length === 1) {
          match = matchesPorCedula[0];
        } else if (matchesPorCedula.length > 1) {
          // Si son hermanos con la misma cédula base, desambiguar por nombre
          const matchHermano = matchesPorCedula.find(
            (e) => e.normNombre === nombreNorm || tokensFila.some((t) => e.tokensNombre.includes(t))
          );
          match = matchHermano || matchesPorCedula[0];
        }
      }

      // ── INTENTO 2: Coincidencia exacta por nombre y sección ──
      if (!match) {
        match =
          estudiantesIndexados.find((e) => {
            const nombreExacto = e.normNombre === nombreNorm;
            if (!nombreExacto) return false;
            if (!seccionNorm) return true;
            return (
              e.normSeccion === seccionNorm ||
              e.normSeccion.includes(seccionNorm) ||
              seccionNorm.includes(e.normSeccion) ||
              e.normGrado.includes(seccionNorm)
            );
          }) || null;
      }

      // ── INTENTO 3: Coincidencia por tokens principales de nombre y sección ──
      if (!match && tokensFila.length >= 2) {
        match =
          estudiantesIndexados.find((e) => {
            const coincidenciasTokens = tokensFila.filter((tok) => e.tokensNombre.includes(tok));
            const tokenMatch = coincidenciasTokens.length >= Math.min(2, tokensFila.length);
            if (!tokenMatch) return false;

            if (!seccionNorm) return true;
            return (
              e.normSeccion === seccionNorm ||
              e.normSeccion.includes(seccionNorm) ||
              seccionNorm.includes(e.normSeccion) ||
              e.normGrado.includes(seccionNorm)
            );
          }) || null;
      }

      // ── INTENTO 4: Nombre único en toda la institución ──
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
      const correoFila = (fila.correo_representante || '').trim().toLowerCase();
      const tieneCorreoFilaValido = Boolean(correoFila && correoFila.includes('@'));

      if (match) {
        let correoRegistrado = match.raw.correo_representante?.trim() || '';

        // Si el estudiante en BD no tenía correo pero el Excel lo incluye, sincronizarlo en la BD
        if (!correoRegistrado && tieneCorreoFilaValido) {
          await sb
            .from('estudiantes')
            .update({
              correo_representante: correoFila,
              updated_at: new Date().toISOString(),
            })
            .eq('id', match.raw.id);
          correoRegistrado = correoFila;
          match.raw.correo_representante = correoFila;
        }

        const tieneCorreoValido = Boolean(correoRegistrado && correoRegistrado.includes('@'));

        filasProcesadas.push({
          idx: index,
          estado: tieneCorreoValido ? ('listo' as const) : ('sin_correo' as const),
          esNuevoRegistro: false,
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
        });
      } else {
        // ── REGISTRO AUTOMÁTICO DE ESTUDIANTES NO ENCONTRADOS ──
        // El usuario solicitó: "si en la lista figuran estudiantes que no tenemos registrados,
        // registralos y luego yo les agrego el correo!!"
        try {
          const { grado: gradoFinal, seccion: seccionFinal } = extraerGradoYSeccion(fila.seccion);
          const nombreCompletoUpper = fila.nombre_estudiante.trim().toUpperCase();

          // Determinar cédula (si vino en archivo, usarla; si no, generar cédula escolar temporal)
          let cedulaFinal = String(fila.cedula || '').trim().toUpperCase().replace(/\s+/g, '');
          if (!cedulaFinal) {
            cedulaFinal = `ESC-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
          } else if (!cedulaFinal.startsWith('V-') && !cedulaFinal.startsWith('E-') && /^\d+$/.test(cedulaFinal)) {
            cedulaFinal = `V-${cedulaFinal}`;
          }

          const nombreSlug = slugifyNombre(nombreCompletoUpper);
          const qrCodeFinal = `ASISTO-${cedulaFinal}-${nombreSlug}`.slice(0, 100);

          const currentYear = new Date().getFullYear();
          const nuevoEstudianteRegistro = {
            cedula: cedulaFinal,
            nombre_completo: nombreCompletoUpper,
            grado: gradoFinal,
            seccion: seccionFinal,
            nombre_representante: nombreRepresentanteFila || `Representante de ${nombreCompletoUpper}`,
            correo_representante: tieneCorreoFilaValido ? correoFila : null,
            qr_code: qrCodeFinal,
            institucion_id: targetInstitucionId,
            estado: 'Activo',
            ano_escolar: `${currentYear}-${currentYear + 1}`,
          };

          const { data: creado, error: errInsert } = await sb
            .from('estudiantes')
            .insert([nuevoEstudianteRegistro])
            .select('id, cedula, nombre_completo, grado, seccion, nombre_representante, correo_representante, foto_url')
            .single();

          if (errInsert || !creado) {
            throw new Error(errInsert?.message || 'Error al insertar alumno nuevo');
          }

          totalNuevosRegistrados++;

          // Agregar al índice local para que próximas filas que repitan a este alumno lo reconozcan
          estudiantesIndexados.push({
            raw: creado,
            baseCedula: cleanBaseCedula(creado.cedula),
            normNombre: normalizarTexto(creado.nombre_completo),
            tokensNombre: normalizarTexto(creado.nombre_completo).split(' ').filter((t) => t.length > 1),
            normSeccion: normalizarTexto(creado.seccion),
            normGrado: normalizarTexto(creado.grado),
          });

          const tieneCorreoNuevo = Boolean(creado.correo_representante && creado.correo_representante.includes('@'));

          filasProcesadas.push({
            idx: index,
            estado: tieneCorreoNuevo ? ('listo' as const) : ('sin_correo' as const),
            esNuevoRegistro: true, // Marcador especial para destacar
            estudiante_id: creado.id,
            cedula: creado.cedula,
            nombre_estudiante: creado.nombre_completo,
            nombre_archivo: fila.nombre_estudiante,
            grado: creado.grado,
            seccion: creado.seccion,
            seccion_archivo: fila.seccion,
            nombre_representante: creado.nombre_representante,
            correo_representante: creado.correo_representante || '',
            deuda_dolares: deuda,
            mora_dolares: mora,
            total_dolares: total,
            mes_vencido: mesVencido,
            foto_url: null,
          });
        } catch (errRegistro) {
          console.warn('[cobranzas/match] No se pudo auto-registrar estudiante:', errRegistro);
          filasProcesadas.push({
            idx: index,
            estado: 'no_encontrado' as const,
            esNuevoRegistro: false,
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
          });
        }
      }
    }

    const totalListos = filasProcesadas.filter((f) => f.estado === 'listo').length;
    const totalSinCorreo = filasProcesadas.filter((f) => f.estado === 'sin_correo').length;
    const totalNoEncontrados = filasProcesadas.filter((f) => f.estado === 'no_encontrado').length;

    return NextResponse.json({
      ok: true,
      resumen: {
        totalFilas: filas.length,
        totalListos,
        totalSinCorreo,
        totalNuevosRegistrados,
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
