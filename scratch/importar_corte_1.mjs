import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { normalizarGrado, esSeccionValida } from '../src/lib/grados-catalogo.ts';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });
const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

function slugifyNombre(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizarClave(clave) {
  return String(clave || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-./]+/g, '_')
    .trim();
}

function mapearColumnas(fila) {
  const mapa = {
    cedula: 'cedula', ci: 'cedula', documento: 'cedula',
    nombres: 'nombres', nombre: 'nombres',
    apellidos: 'apellidos', apellido: 'apellidos',
    nombre_completo: 'nombre_completo', nombres_y_apellidos: 'nombre_completo', alumno: 'nombre_completo', estudiante: 'nombre_completo',
    genero: 'genero', sexo: 'genero',
    grado_ano: 'grado_ano', grado: 'grado_ano', ano: 'grado_ano', anio: 'grado_ano', curso: 'grado_ano', nivel: 'grado_ano',
    seccion: 'seccion', seccion_: 'seccion', grupo: 'seccion',
    representante_nombre: 'representante_nombre', representante: 'representante_nombre', nombre_representante: 'representante_nombre', nombre_del_representante: 'representante_nombre',
    representante_telefono: 'representante_telefono', telefono: 'representante_telefono', telefono_representante: 'representante_telefono',
    representante_correo: 'representante_correo', correo: 'representante_correo', email: 'representante_correo', correo_representante: 'representante_correo', correo_del_representante: 'representante_correo', mail: 'representante_correo',
    estado: 'estado', estatus: 'estado',
  };

  const resultado = {};
  for (const [claveOriginal, valor] of Object.entries(fila)) {
    const claveNorm = normalizarClave(claveOriginal);
    const campoDestino = mapa[claveNorm];
    if (campoDestino) {
      resultado[campoDestino] = valor;
    }
  }
  return resultado;
}

async function ejecutarImportacion() {
  const filePath = path.resolve('docs', 'corte 1 de alumnos CRC - Asisto.xlsx');
  console.log("📂 Leyendo archivo Excel:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("❌ El archivo no existe:", filePath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  console.log(`📊 Hoja: "${firstSheetName}" — Total de filas en archivo: ${rawRows.length}`);

  if (rawRows.length === 0) {
    console.error("❌ La hoja de cálculo está vacía");
    process.exit(1);
  }

  // 1. Mapeo y parsing preliminar de filas
  const filasParseadas = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const mapped = mapearColumnas(raw);

    const cedulaRaw = String(mapped.cedula ?? '').trim().replace(/\.0$/, '').replace(/\s+/g, '');
    const cedulaBase = cedulaRaw.replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '').replace(/[^0-9a-zA-Z]/g, '');

    let nombre = '';
    if (mapped.nombres || mapped.apellidos) {
      const nombres = String(mapped.nombres ?? '').trim().toUpperCase();
      const apellidos = String(mapped.apellidos ?? '').trim().toUpperCase();
      nombre = `${apellidos} ${nombres}`.trim();
    } else {
      nombre = String(mapped.nombre_completo ?? '').trim().toUpperCase();
    }

    // Saltar filas vacías
    if (!cedulaBase && !nombre) continue;

    const generoRaw = String(mapped.genero ?? '').trim().toUpperCase();
    const genero = generoRaw === 'M' || generoRaw === 'MASCULINO' ? 'M'
      : generoRaw === 'F' || generoRaw === 'FEMENINO' ? 'F'
      : null;

    const gradoRaw = String(mapped.grado_ano ?? '').trim();
    const gradoCanonico = normalizarGrado(gradoRaw) ?? (gradoRaw || '1er Grado');

    const seccionRaw = String(mapped.seccion ?? '').trim().toUpperCase();
    const seccion = esSeccionValida(seccionRaw) ? seccionRaw : 'A';

    const representanteRaw = String(mapped.representante_nombre ?? '').trim();
    const representante = representanteRaw || `REPRESENTANTE DE ${nombre}`;

    const correoRaw = String(mapped.representante_correo ?? '').trim().toLowerCase();
    const esCorreoValido = correoRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoRaw);
    const correo = esCorreoValido ? correoRaw : `representante.${cedulaBase || i}@colegio.com`;

    filasParseadas.push({
      nroFila: i + 2,
      cedulaBase: cedulaBase || `ESC-${1000 + i}`,
      nombreCompleto: nombre || `ALUMNO SIN NOMBRE F${i+2}`,
      genero,
      grado: String(gradoCanonico),
      seccion,
      representante,
      correo,
      estado: 'Activo',
    });
  }

  console.log(`✅ Filas válidas procesadas: ${filasParseadas.length}`);

  // 2. Obtener estudiantes existentes en Supabase
  const { data: existentes, error: errExist } = await sb
    .from('estudiantes')
    .select('id, cedula, nombre_completo, qr_code')
    .eq('institucion_id', COLEGIO_ID);

  if (errExist) {
    console.error("❌ Error consultando estudiantes existentes:", errExist.message);
    process.exit(1);
  }

  const mapaExistentesPorBaseCedula = {};
  (existentes ?? []).forEach(est => {
    const base = est.cedula.replace(/-H\d+$/i, '').replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '').trim();
    if (!mapaExistentesPorBaseCedula[base]) mapaExistentesPorBaseCedula[base] = [];
    mapaExistentesPorBaseCedula[base].push(est);
  });

  const conteoEnLote = {};
  filasParseadas.forEach(c => {
    conteoEnLote[c.cedulaBase] = (conteoEnLote[c.cedulaBase] || 0) + 1;
  });

  const aInsertar = [];
  const omitidosDuplicados = [];
  const contadorSufijoHermano = {};

  for (const base of Object.keys(conteoEnLote)) {
    const exist = mapaExistentesPorBaseCedula[base] || [];
    contadorSufijoHermano[base] = exist.length;
  }

  const currentYear = new Date().getFullYear();

  for (const cand of filasParseadas) {
    const base = cand.cedulaBase;
    const exist = mapaExistentesPorBaseCedula[base] || [];

    const yaExiste = exist.some(
      e => e.nombre_completo.trim().toUpperCase() === cand.nombreCompleto.trim().toUpperCase()
    );

    if (yaExiste) {
      omitidosDuplicados.push(cand);
      continue;
    }

    const totalHermanos = (exist.length) + (conteoEnLote[base] || 1);
    let cedulaFinal = base;
    if (totalHermanos > 1) {
      contadorSufijoHermano[base] = (contadorSufijoHermano[base] || 0) + 1;
      cedulaFinal = `${base}-H${contadorSufijoHermano[base]}`;
    }

    const nombreSlug = slugifyNombre(cand.nombreCompleto);
    const qrCode = `ASISTO-${base}-${nombreSlug}`;

    const reg = {
      cedula: cedulaFinal,
      nombre_completo: cand.nombreCompleto,
      grado: cand.grado,
      seccion: cand.seccion,
      nombre_representante: cand.representante,
      correo_representante: cand.correo,
      qr_code: qrCode,
      institucion_id: COLEGIO_ID,
      estado: cand.estado,
      ano_escolar: `${currentYear}-${currentYear + 1}`,
    };

    aInsertar.push(reg);
  }

  console.log(`\n📥 Alumnos nuevos a insertar en Supabase: ${aInsertar.length}`);
  console.log(`ℹ️ Alumnos ya registrados previamente: ${omitidosDuplicados.length}`);

  // 3. Inserción en lotes de 50
  let insertadosExitosos = 0;
  const errores = [];

  if (aInsertar.length > 0) {
    const LOTE = 50;
    for (let i = 0; i < aInsertar.length; i += LOTE) {
      const segmento = aInsertar.slice(i, i + LOTE);
      const { data: insData, error: insErr } = await sb
        .from('estudiantes')
        .insert(segmento)
        .select('id, cedula, nombre_completo, grado, seccion');

      if (insErr) {
        console.error(`❌ Error en lote ${i/LOTE + 1}:`, insErr.message);
        errores.push(insErr.message);
      } else {
        insertadosExitosos += (insData?.length || 0);
        console.log(`   - Lote ${Math.floor(i/LOTE) + 1}: ${insData?.length || 0} alumnos insertados exitosamente.`);
      }
    }
  }

  // 4. Conteo final en Supabase
  const { count: totalFinal } = await sb.from('estudiantes').select('id', { count: 'exact', head: true });

  // 5. Desglose por Grado
  const { data: resumenGrados } = await sb.from('estudiantes').select('grado, seccion');
  const desgloseGrado = {};
  (resumenGrados ?? []).forEach(e => {
    const key = `${e.grado} "${e.seccion}"`;
    desgloseGrado[key] = (desgloseGrado[key] || 0) + 1;
  });

  console.log("\n==================================================================");
  console.log(" RESUMEN FINAL DE LA IMPORTACIÓN ");
  console.log("==================================================================");
  console.log(`✅ Nuevos Estudiantes Insertados: ${insertadosExitosos}`);
  console.log(`ℹ️ Omitidos por estar registrados anteriormente: ${omitidosDuplicados.length}`);
  console.log(`❌ Errores: ${errores.length}`);
  console.log(`🏆 TOTAL FINAL DE ESTUDIANTES ACTIVOS EN SUPABASE: ${totalFinal}`);
  console.log("\n📊 DESGLOSE POR GRADO Y SECCIÓN:");
  console.table(desgloseGrado);
  console.log("==================================================================");
}

ejecutarImportacion();
