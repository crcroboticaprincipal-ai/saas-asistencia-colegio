import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { esGradoValido, esSeccionValida, normalizarGrado } from '@/lib/grados-catalogo';

const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload.role !== 'service_role') {
        throw new Error(`Llave con rol "${payload.role}" — se necesita service_role`);
      }
    }
  } catch { /* silent */ }
  return createClient(url, key, { auth: { persistSession: false } });
}

interface FilaExcel {
  cedula?: string | number;
  nombres?: string;
  apellidos?: string;
  nombre_completo?: string;
  genero?: string;
  grado_ano?: string;
  grado?: string;
  seccion?: string;
  representante_nombre?: string;
  nombre_representante?: string;
  representante_telefono?: string;
  representante_correo?: string;
  correo_representante?: string;
  estado?: string;
  [key: string]: unknown;
}

interface ResultadoFila {
  fila: number;
  nombre: string;
  cedula: string;
  estado: 'ok' | 'error' | 'duplicado';
  grado?: string;
  seccion?: string;
  mensaje?: string;
}

function normalizarClave(clave: string): string {
  return clave
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-./]+/g, '_')
    .trim();
}

function mapearColumnas(fila: Record<string, unknown>): FilaExcel {
  const mapa: Record<string, string> = {
    cedula: 'cedula',
    ci: 'cedula',
    documento: 'cedula',
    nombres: 'nombres',
    nombre: 'nombres',
    apellidos: 'apellidos',
    apellido: 'apellidos',
    nombre_completo: 'nombre_completo',
    nombres_y_apellidos: 'nombre_completo',
    alumno: 'nombre_completo',
    estudiante: 'nombre_completo',
    genero: 'genero',
    sexo: 'genero',
    grado_ano: 'grado_ano',
    grado: 'grado_ano',
    ano: 'grado_ano',
    anio: 'grado_ano',
    curso: 'grado_ano',
    nivel: 'grado_ano',
    seccion: 'seccion',
    seccion_: 'seccion',
    grupo: 'seccion',
    representante_nombre: 'representante_nombre',
    representante: 'representante_nombre',
    nombre_representante: 'representante_nombre',
    nombre_del_representante: 'representante_nombre',
    representante_telefono: 'representante_telefono',
    telefono: 'representante_telefono',
    telefono_representante: 'representante_telefono',
    representante_correo: 'representante_correo',
    correo: 'representante_correo',
    email: 'representante_correo',
    correo_representante: 'representante_correo',
    correo_del_representante: 'representante_correo',
    mail: 'representante_correo',
    estado: 'estado',
    estatus: 'estado',
  };

  const resultado: FilaExcel = {};
  for (const [claveOriginal, valor] of Object.entries(fila)) {
    const claveNorm = normalizarClave(claveOriginal);
    const campoDestino = mapa[claveNorm];
    if (campoDestino) {
      resultado[campoDestino] = valor as string;
    }
  }
  return resultado;
}

function slugifyNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo') as File | null;

    if (!archivo) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const extensionValida = /\.(xlsx|xls|csv)$/i.test(archivo.name);
    if (!extensionValida) {
      return NextResponse.json({ error: 'Formato inválido. Use .xlsx, .xls o .csv' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });

    const hojaNombre = workbook.SheetNames[0];
    const hoja = workbook.Sheets[hojaNombre];
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
      defval: '',
      raw: false,
    });

    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: 'La hoja de cálculo está vacía o sin datos' }, { status: 400 });
    }

    if (filas.length > 500) {
      return NextResponse.json({ error: 'Límite de 500 estudiantes por carga' }, { status: 400 });
    }

    const sb = getAdmin();
    const resultados: ResultadoFila[] = [];
    const candidatosValidados: Array<{
      nroFila: number;
      cedulaBase: string;
      nombreCompleto: string;
      genero: string | null;
      grado: string;
      seccion: string;
      representante: string;
      telefono: string;
      correo: string;
      estado: string;
    }> = [];
    const erroresValidacion: ResultadoFila[] = [];

    // ── 1. Validación individual de cada fila ──────────────────────────────────
    for (let i = 0; i < filas.length; i++) {
      const fila = mapearColumnas(filas[i]);
      const nroFila = i + 2;

      // Cédula base sin prefijos ni decimales .0
      const cedulaRaw = String(fila.cedula ?? '').trim().replace(/\.0$/, '').replace(/\s+/g, '');
      const cedulaBase = cedulaRaw.replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '').replace(/[^0-9a-zA-Z]/g, '');

      // Nombre completo
      let nombre: string;
      if (fila.nombres || fila.apellidos) {
        const nombres = String(fila.nombres ?? '').trim().toUpperCase();
        const apellidos = String(fila.apellidos ?? '').trim().toUpperCase();
        nombre = `${apellidos} ${nombres}`.trim();
      } else {
        nombre = String(fila.nombre_completo ?? '').trim().toUpperCase();
      }

      // Si la fila está completamente vacía (sin cédula y sin nombre), ignorarla en silencio
      if (!cedulaBase && !nombre) {
        continue;
      }

      if (!cedulaBase) {
        erroresValidacion.push({ fila: nroFila, nombre: nombre || '(sin nombre)', cedula: '', estado: 'error', mensaje: 'Cédula vacía o no válida' });
        continue;
      }
      if (!nombre) {
        erroresValidacion.push({ fila: nroFila, nombre: '(sin nombre)', cedula: cedulaBase, estado: 'error', mensaje: 'Nombre/Apellido vacíos' });
        continue;
      }

      // Grado & Sección con normalización e inteligencias de rescate
      const gradoRaw = String(fila.grado_ano ?? '').trim();
      const gradoCanonico = normalizarGrado(gradoRaw) ?? (gradoRaw || '1er Grado');

      const seccionRaw = String(fila.seccion ?? '').trim().toUpperCase();
      const seccionFinal = esSeccionValida(seccionRaw) ? seccionRaw : 'A';

      // Género
      const generoRaw = String(fila.genero ?? '').trim().toUpperCase();
      const genero = generoRaw === 'M' || generoRaw === 'MASCULINO' ? 'M'
        : generoRaw === 'F' || generoRaw === 'FEMENINO' ? 'F'
        : null;

      // Representante & Correo con valores de rescate por defecto
      const representanteRaw = String(fila.representante_nombre ?? fila.nombre_representante ?? '').trim();
      const representante = representanteRaw || `REPRESENTANTE DE ${nombre}`;

      const telefono = String(fila.representante_telefono ?? '').trim();
      
      const correoRaw = String(fila.representante_correo ?? fila.correo_representante ?? '').trim().toLowerCase();
      const esCorreoValido = correoRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoRaw);
      const correo = esCorreoValido ? correoRaw : `representante.${cedulaBase}@colegio.com`;

      const estado = String(fila.estado ?? 'Activo').trim();

      candidatosValidados.push({
        nroFila,
        cedulaBase,
        nombreCompleto: nombre,
        genero,
        grado: String(gradoCanonico),
        seccion: seccionFinal,
        representante,
        telefono,
        correo,
        estado: ['Activo', 'Retirado', 'Graduado'].includes(estado) ? estado : 'Activo',
      });
    }

    // Si existen errores de sintaxis/formato en la plantilla, abortar pre-insert
    if (erroresValidacion.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Se encontraron ${erroresValidacion.length} error(es) de validación. Corrígelos y vuelve a intentar.`,
        errores: erroresValidacion,
        resumen: { total: filas.length, insertados: 0, duplicados: 0, errores: erroresValidacion.length },
      }, { status: 422 });
    }

    // ── 2. Verificación de duplicados y asignación de QR/Cédulas para hermanos ─
    if (candidatosValidados.length > 0) {
      const cedulasUnicasEnLote = Array.from(new Set(candidatosValidados.map(c => c.cedulaBase)));
      
      // Consultar estudiantes existentes en Supabase que compartan estas cédulas base
      const { data: estudiantesExistentes } = await sb
        .from('estudiantes')
        .select('id, cedula, nombre_completo, qr_code')
        .eq('institucion_id', COLEGIO_ID);

      // Mapa para rastrear estudiantes por cédula base y por nombre
      const mapaExistentesPorBaseCedula: Record<string, Array<{ cedula: string; nombre_completo: string }>> = {};
      (estudiantesExistentes ?? []).forEach(est => {
        const base = est.cedula.replace(/-H\d+$/i, '').replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '').trim();
        if (!mapaExistentesPorBaseCedula[base]) mapaExistentesPorBaseCedula[base] = [];
        mapaExistentesPorBaseCedula[base].push(est);
      });

      // Contar repeticiones de la misma cédula base dentro del propio archivo importado
      const conteoEnLote: Record<string, number> = {};
      candidatosValidados.forEach(c => {
        conteoEnLote[c.cedulaBase] = (conteoEnLote[c.cedulaBase] || 0) + 1;
      });

      const estudiantesAInsertar: Record<string, string>[] = [];
      const contadorSufijoHermano: Record<string, number> = {};

      // Inicializar contador de sufijos según registros existentes en BD
      for (const base of cedulasUnicasEnLote) {
        const exist = mapaExistentesPorBaseCedula[base] || [];
        contadorSufijoHermano[base] = exist.length;
      }

      for (const cand of candidatosValidados) {
        const base = cand.cedulaBase;
        const exist = mapaExistentesPorBaseCedula[base] || [];

        // Verificar si el estudiante específico (mismo nombre + misma cédula base) ya existe en BD
        const yaExisteEnBD = exist.some(
          e => e.nombre_completo.trim().toUpperCase() === cand.nombreCompleto.trim().toUpperCase()
        );

        if (yaExisteEnBD) {
          resultados.push({
            fila: cand.nroFila,
            nombre: cand.nombreCompleto,
            cedula: base,
            estado: 'duplicado',
            grado: cand.grado,
            seccion: cand.seccion,
            mensaje: 'Estudiante ya registrado anteriormente — omitido',
          });
          continue;
        }

        // Si hay múltiples alumnos con la misma cédula (hermanos en BD o en el archivo)
        const totalHermanos = (exist.length) + (conteoEnLote[base] || 1);
        let cedulaFinalDisplay = base;

        if (totalHermanos > 1) {
          contadorSufijoHermano[base] = (contadorSufijoHermano[base] || 0) + 1;
          cedulaFinalDisplay = `${base}-H${contadorSufijoHermano[base]}`;
        }

        // Generar código QR único e independiente por estudiante (incluyendo sufijo de hermano)
        const nombreSlug = slugifyNombre(cand.nombreCompleto);
        const qrCodeUnico = `ASISTO-${cedulaFinalDisplay}-${nombreSlug}`;

        const currentYear = new Date().getFullYear();
        const registro: Record<string, string> = {
          cedula: cedulaFinalDisplay,
          nombre_completo: cand.nombreCompleto,
          grado: cand.grado,
          seccion: cand.seccion,
          nombre_representante: cand.representante,
          correo_representante: cand.correo,
          qr_code: qrCodeUnico,
          institucion_id: COLEGIO_ID,
          estado: cand.estado,
          ano_escolar: `${currentYear}-${currentYear + 1}`,
        };

        if (cand.genero) registro.genero = cand.genero;

        estudiantesAInsertar.push(registro);
      }

      // ── 3. Inserción en lotes de 50 ───────────────────────────────────────────
      if (estudiantesAInsertar.length > 0) {
        const LOTE = 50;
        for (let i = 0; i < estudiantesAInsertar.length; i += LOTE) {
          const segmento = estudiantesAInsertar.slice(i, i + LOTE);
          const { data: insertados, error: errInsert } = await sb
            .from('estudiantes')
            .insert(segmento)
            .select('cedula, nombre_completo, grado, seccion, qr_code');

          if (errInsert) {
            for (const est of segmento) {
              resultados.push({
                fila: 0,
                nombre: est.nombre_completo,
                cedula: est.cedula,
                estado: 'error',
                mensaje: `Error BD: ${errInsert.message}`,
              });
            }
          } else {
            for (const ins of (insertados ?? [])) {
              resultados.push({
                fila: 0,
                nombre: ins.nombre_completo,
                cedula: ins.cedula,
                estado: 'ok',
                grado: ins.grado,
                seccion: ins.seccion,
                mensaje: 'Insertado correctamente',
              });
            }
          }
        }
      }
    }

    const insertados = resultados.filter(r => r.estado === 'ok').length;
    const duplicados = resultados.filter(r => r.estado === 'duplicado').length;
    const errores = resultados.filter(r => r.estado === 'error').length;

    return NextResponse.json({
      ok: true,
      resumen: { total: filas.length, insertados, duplicados, errores },
      resultados,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al procesar el archivo';
    console.error('[bulk/route] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
