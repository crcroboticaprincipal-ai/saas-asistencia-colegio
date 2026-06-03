import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim().replace(/^"|"$/g, '');
        }
      }
    } catch (e) {
      console.warn('Manual reading of .env.local failed:', e);
    }
  }

  if (!key) {
    throw new Error(
      '⚠️ Error crítico: La variable SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. ' +
      'Si estás en desarrollo local, por favor reinicia tu servidor (npm run dev) para cargar las variables del archivo .env.local.'
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

interface FilaExcel {
  cedula?: string | number;
  nombre_completo?: string;
  grado?: string;
  seccion?: string;
  nombre_representante?: string;
  correo_representante?: string;
  estado?: string;
  [key: string]: unknown;
}

interface ResultadoFila {
  fila: number;
  nombre: string;
  cedula: string;
  estado: 'ok' | 'error' | 'duplicado';
  mensaje?: string;
}

// Normaliza encabezados flexibles del Excel
function normalizarClave(clave: string): string {
  return clave
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '_')
    .trim();
}

function mapearColumnas(fila: Record<string, unknown>): FilaExcel {
  const mapa: Record<string, string> = {
    cedula: 'cedula',
    ci: 'cedula',
    documento: 'cedula',
    nombre: 'nombre_completo',
    nombre_completo: 'nombre_completo',
    nombres_y_apellidos: 'nombre_completo',
    alumno: 'nombre_completo',
    grado: 'grado',
    ano: 'grado',
    anio: 'grado',
    curso: 'grado',
    seccion: 'seccion',
    seccion_: 'seccion',
    grupo: 'seccion',
    representante: 'nombre_representante',
    nombre_representante: 'nombre_representante',
    nombre_del_representante: 'nombre_representante',
    correo: 'correo_representante',
    email: 'correo_representante',
    correo_representante: 'correo_representante',
    correo_del_representante: 'correo_representante',
    mail: 'correo_representante',
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

    // Leer buffer del archivo
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

    // ── Validación y construcción del lote ──
    for (let i = 0; i < filas.length; i++) {
      const fila = mapearColumnas(filas[i]);
      const nroFila = i + 2; // +2 porque fila 1 = encabezado

      const cedulaRaw = String(fila.cedula ?? '').trim().replace(/\s+/g, '');
      const cedula = cedulaRaw.replace(/^(V-|E-|RC-|QR-)/i, '').replace(/[^0-9a-zA-Z]/g, '');
      const nombre = String(fila.nombre_completo ?? '').trim().toUpperCase();
      const grado = String(fila.grado ?? '').trim().toUpperCase();
      const seccion = String(fila.seccion ?? '').trim().toUpperCase();
      const representante = String(fila.nombre_representante ?? '').trim();
      const correo = String(fila.correo_representante ?? '').trim().toLowerCase();
      const estado = String(fila.estado ?? 'Activo').trim();

      // Validaciones mínimas
      if (!cedula) {
        resultados.push({ fila: nroFila, nombre: nombre || '(sin nombre)', cedula: '', estado: 'error', mensaje: 'Cédula vacía' });
        continue;
      }
      if (!nombre) {
        resultados.push({ fila: nroFila, nombre: '(sin nombre)', cedula, estado: 'error', mensaje: 'Nombre completo vacío' });
        continue;
      }
      if (!grado) {
        resultados.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Grado/Año vacío' });
        continue;
      }
      if (!seccion) {
        resultados.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Sección vacía' });
        continue;
      }
      if (!representante) {
        resultados.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Nombre de representante vacío' });
        continue;
      }
      if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        resultados.push({ fila: nroFila, nombre, cedula, estado: 'error', mensaje: 'Correo de representante inválido' });
        continue;
      }

      // Duplicado dentro del mismo lote
      if (cedulasEnLote.has(cedula)) {
        resultados.push({ fila: nroFila, nombre, cedula, estado: 'duplicado', mensaje: 'Cédula duplicada en el archivo' });
        continue;
      }
      cedulasEnLote.add(cedula);

      const estadoFinal = ['Activo', 'Retirado', 'Graduado'].includes(estado) ? estado : 'Activo';

      estudiantesAInsertar.push({
        cedula,
        nombre_completo: nombre,
        grado,
        seccion,
        nombre_representante: representante,
        correo_representante: correo,
        qr_code: `RC-${cedula}`,
        institucion_id: COLEGIO_ID,
        estado: estadoFinal,
      });
    }

    // ── Verificar duplicados contra la BD ──
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
            fila: 0,
            nombre: est.nombre_completo,
            cedula: est.cedula,
            estado: 'duplicado',
            mensaje: 'Ya existe en la base de datos — omitido',
          });
        } else {
          aNuevos.push(est);
        }
      }

      // ── Insertar en lotes de 50 ──
      if (aNuevos.length > 0) {
        const LOTE = 50;
        for (let i = 0; i < aNuevos.length; i += LOTE) {
          const segmento = aNuevos.slice(i, i + LOTE);
          const { data: insertados, error: errInsert } = await sb
            .from('estudiantes')
            .insert(segmento)
            .select('cedula, nombre_completo');

          if (errInsert) {
            // Marcar todo el segmento como error
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
