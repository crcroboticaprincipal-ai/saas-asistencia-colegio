import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { esGradoValido, esSeccionValida } from '@/lib/grados-catalogo';

const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  // Validate service_role JWT
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
    // Nuevos campos separados
    nombres: 'nombres',
    nombre: 'nombres',
    apellidos: 'apellidos',
    apellido: 'apellidos',
    // Nombre completo (legado)
    nombre_completo: 'nombre_completo',
    nombres_y_apellidos: 'nombre_completo',
    alumno: 'nombre_completo',
    estudiante: 'nombre_completo',
    // Género
    genero: 'genero',
    sexo: 'genero',
    // Grado (nuevo campo grado_ano o legacy grado)
    grado_ano: 'grado_ano',
    grado: 'grado_ano',
    ano: 'grado_ano',
    anio: 'grado_ano',
    curso: 'grado_ano',
    nivel: 'grado_ano',
    // Sección
    seccion: 'seccion',
    seccion_: 'seccion',
    grupo: 'seccion',
    // Representante
    representante_nombre: 'representante_nombre',
    representante: 'representante_nombre',
    nombre_representante: 'representante_nombre',
    nombre_del_representante: 'representante_nombre',
    // Teléfono representante
    representante_telefono: 'representante_telefono',
    telefono: 'representante_telefono',
    telefono_representante: 'representante_telefono',
    // Correo representante
    representante_correo: 'representante_correo',
    correo: 'representante_correo',
    email: 'representante_correo',
    correo_representante: 'representante_correo',
    correo_del_representante: 'representante_correo',
    mail: 'representante_correo',
    // Estado
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
    const estudiantesAInsertar: Record<string, string>[] = [];
    const cedulasEnLote = new Set<string>();
    const erroresValidacion: ResultadoFila[] = [];

    // ── Validación y construcción del lote ────────────────────────────────────
    for (let i = 0; i < filas.length; i++) {
      const fila = mapearColumnas(filas[i]);
      const nroFila = i + 2;

      // Cédula
      const cedulaRaw = String(fila.cedula ?? '').trim().replace(/\s+/g, '');
      const cedula = cedulaRaw.replace(/^(V-|E-|RC-|QR-)/i, '').replace(/[^0-9a-zA-Z]/g, '');

      // Nombre completo: admite campo separado nombres/apellidos O nombre_completo legacy
      let nombre: string;
      if (fila.nombres || fila.apellidos) {
        const nombres = String(fila.nombres ?? '').trim().toUpperCase();
        const apellidos = String(fila.apellidos ?? '').trim().toUpperCase();
        nombre = `${apellidos} ${nombres}`.trim();
      } else {
        nombre = String(fila.nombre_completo ?? '').trim().toUpperCase();
      }

      // Género
      const generoRaw = String(fila.genero ?? '').trim().toUpperCase();
      const genero = generoRaw === 'M' || generoRaw === 'MASCULINO' ? 'M'
        : generoRaw === 'F' || generoRaw === 'FEMENINO' ? 'F'
        : null;

      // Grado (grado_ano tiene prioridad)
      const gradoRaw = String(fila.grado_ano ?? '').trim();
      const seccionRaw = String(fila.seccion ?? '').trim().toUpperCase();

      // Representante
      const representante = String(fila.representante_nombre ?? fila.nombre_representante ?? '').trim();
      const telefono = String(fila.representante_telefono ?? '').trim();
      const correo = String(fila.representante_correo ?? fila.correo_representante ?? '').trim().toLowerCase();
      const estado = String(fila.estado ?? 'Activo').trim();

      // ── Validaciones mínimas ────────────────────────────────────────────────
      if (!cedula) {
        erroresValidacion.push({ fila: nroFila, nombre: nombre || '(sin nombre)', cedula: '', estado: 'error', mensaje: 'Cédula vacía' });
        continue;
      }
      if (!nombre) {
        erroresValidacion.push({ fila: nroFila, nombre: '(sin nombre)', cedula, estado: 'error', mensaje: 'Nombre/Apellido vacíos' });
        continue;
      }
      if (!gradoRaw) {
        erroresValidacion.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Grado/Año vacío' });
        continue;
      }
      if (!esGradoValido(gradoRaw)) {
        erroresValidacion.push({
          fila: nroFila, nombre, cedula, estado: 'error',
          mensaje: `Grado "${gradoRaw}" no es un valor canónico válido. Usa la lista desplegable de la plantilla.`,
        });
        continue;
      }
      if (!seccionRaw) {
        erroresValidacion.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Sección vacía' });
        continue;
      }
      if (!esSeccionValida(seccionRaw)) {
        erroresValidacion.push({
          fila: nroFila, nombre, cedula, estado: 'error',
          mensaje: `Sección "${seccionRaw}" inválida. Solo se permiten: A, B.`,
        });
        continue;
      }
      if (!representante) {
        erroresValidacion.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Nombre de representante vacío' });
        continue;
      }
      if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        erroresValidacion.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Correo de representante inválido o vacío' });
        continue;
      }

      // Duplicado en lote
      if (cedulasEnLote.has(cedula)) {
        erroresValidacion.push({ fila: nroFila, nombre, cedula, estado: 'duplicado', mensaje: 'Cédula duplicada en el archivo' });
        continue;
      }
      cedulasEnLote.add(cedula);

      const estadoFinal = ['Activo', 'Retirado', 'Graduado'].includes(estado) ? estado : 'Activo';
      const currentYear = new Date().getFullYear();

      const registro: Record<string, string> = {
        cedula,
        nombre_completo: nombre,
        grado: gradoRaw,
        seccion: seccionRaw,
        nombre_representante: representante,
        correo_representante: correo,
        qr_code: `RC-${cedula}`,
        institucion_id: COLEGIO_ID,
        estado: estadoFinal,
        ano_escolar: `${currentYear}-${currentYear + 1}`,
      };

      if (genero) registro.genero = genero;
      if (telefono) registro.telefono_representante = telefono;

      estudiantesAInsertar.push(registro);
    }

    // Si hay errores de validación, retornar ANTES de tocar Supabase
    if (erroresValidacion.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `Se encontraron ${erroresValidacion.length} error(es) de validación. Corrígelos y vuelve a intentar.`,
        errores: erroresValidacion,
        resumen: { total: filas.length, insertados: 0, duplicados: 0, errores: erroresValidacion.length },
      }, { status: 422 });
    }

    // ── Verificar duplicados contra la BD ─────────────────────────────────────
    if (estudiantesAInsertar.length > 0) {
      const cedulasLote = estudiantesAInsertar.map(e => e.cedula);
      const { data: existentes } = await sb
        .from('estudiantes')
        .select('cedula')
        .eq('institucion_id', COLEGIO_ID)
        .in('cedula', cedulasLote);

      const cedulasExistentes = new Set((existentes ?? []).map(e => e.cedula));
      const aNuevos: typeof estudiantesAInsertar = [];

      for (const est of estudiantesAInsertar) {
        if (cedulasExistentes.has(est.cedula)) {
          resultados.push({
            fila: 0, nombre: est.nombre_completo, cedula: est.cedula,
            estado: 'duplicado', grado: est.grado, seccion: est.seccion,
            mensaje: 'Ya existe en la base de datos — omitido',
          });
        } else {
          aNuevos.push(est);
        }
      }

      // ── Insertar en lotes de 50 ───────────────────────────────────────────
      if (aNuevos.length > 0) {
        const LOTE = 50;
        for (let i = 0; i < aNuevos.length; i += LOTE) {
          const segmento = aNuevos.slice(i, i + LOTE);
          const { data: insertados, error: errInsert } = await sb
            .from('estudiantes')
            .insert(segmento)
            .select('cedula, nombre_completo, grado, seccion');

          if (errInsert) {
            for (const est of segmento) {
              resultados.push({
                fila: 0, nombre: est.nombre_completo, cedula: est.cedula,
                estado: 'error', mensaje: `Error BD: ${errInsert.message}`,
              });
            }
          } else {
            for (const ins of (insertados ?? [])) {
              resultados.push({
                fila: 0, nombre: ins.nombre_completo, cedula: ins.cedula,
                estado: 'ok', grado: ins.grado, seccion: ins.seccion,
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
