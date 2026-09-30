import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

function slugifyNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function vocalWildcard(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[AEIOUN]/g, '_');
}

async function buscarEstudianteSimulado(supabase, input) {
  if (!input || !input.trim()) return null;
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');
  const originalInput = input.trim();
  const soloNumeros = raw.replace(/^(ASISTO-|RC-|QR-|V-|E-)/, '').replace(/[^0-9]/g, '');

  // 1. qr_code exacto
  if (raw) {
    const { data: estByQr } = await supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, qr_code')
      .eq('qr_code', raw)
      .maybeSingle();

    if (estByQr) return estByQr;

    // 1.5. cedula exacta
    const { data: estByCedExact } = await supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, qr_code')
      .eq('cedula', raw)
      .maybeSingle();

    if (estByCedExact) return estByCedExact;
  }

  // 2. Cédula limpia (números puros)
  if (soloNumeros) {
    const { data: estByCed } = await supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, qr_code')
      .eq('cedula', soloNumeros)
      .maybeSingle();

    if (estByCed) return estByCed;

    // Sufijos de hermano (-H1, -H2)
    const { data: estsHermano } = await supabase
      .from('estudiantes')
      .select('id, cedula, nombre_completo, qr_code')
      .ilike('cedula', `${soloNumeros}-H%`)
      .limit(1);

    if (estsHermano && estsHermano.length > 0) return estsHermano[0];

    for (const pref of ['V-', 'E-', 'RC-', 'QR-']) {
      const { data: estPref } = await supabase
        .from('estudiantes')
        .select('id, cedula, nombre_completo, qr_code')
        .or(`cedula.eq.${pref}${soloNumeros},qr_code.eq.${pref}${soloNumeros}`)
        .maybeSingle();
      if (estPref) return estPref;
    }
  }

  // 3. Nombre completo tokenizado
  const palabras = originalInput.split(/\s+/).filter(p => p.length > 1);
  if (palabras.length > 0) {
    let query = supabase.from('estudiantes').select('id, cedula, nombre_completo, qr_code');
    for (const pal of palabras) {
      const pattern = vocalWildcard(pal);
      query = query.ilike('nombre_completo', `%${pattern}%`);
    }
    const { data: estByNombre } = await query.limit(1);
    if (estByNombre && estByNombre.length > 0) return estByNombre[0];
  }

  return null;
}

async function auditarTodosLosEstudiantes() {
  console.log("==================================================================");
  console.log(" AUDITORÍA COMPLETA DE CÓDIGOS QR Y BUSQUEDAS EN SUPABASE ");
  console.log("==================================================================");

  const { data: todos, error } = await sb
    .from('estudiantes')
    .select('id, cedula, nombre_completo, qr_code, grado, seccion')
    .order('nombre_completo');

  if (error || !todos) {
    console.error("❌ Error obteniendo estudiantes de Supabase:", error);
    process.exit(1);
  }

  console.log(`📊 Total de estudiantes en la base de datos: ${todos.length}`);

  let sinQrCount = 0;
  let qrFallaCount = 0;
  let cedulaFallaCount = 0;
  let exitososCount = 0;
  const reparaciones = [];
  const fallasReporte = [];

  for (let i = 0; i < todos.length; i++) {
    const est = todos[i];
    const nro = i + 1;

    // Verificar si el QR está vacío o malformado
    if (!est.qr_code || !est.qr_code.trim()) {
      sinQrCount++;
      const baseCed = est.cedula.replace(/-H\d+$/i, '').replace(/[^0-9a-zA-Z]/g, '');
      const qrNuevo = `ASISTO-${baseCed}-${slugifyNombre(est.nombre_completo)}`;
      reparaciones.push({ id: est.id, qr_code: qrNuevo, nombre: est.nombre_completo });
      continue;
    }

    // 1. Probar búsqueda por su QR Code exacto
    const resultadoQr = await buscarEstudianteSimulado(sb, est.qr_code);
    if (!resultadoQr || resultadoQr.id !== est.id) {
      qrFallaCount++;
      fallasReporte.push({
        nro, id: est.id, cedula: est.cedula, nombre: est.nombre_completo,
        qr: est.qr_code, causa: 'Fallo al buscar por QR Code'
      });
      continue;
    }

    // 2. Probar búsqueda por su Cédula exacta
    const resultadoCed = await buscarEstudianteSimulado(sb, est.cedula);
    if (!resultadoCed) {
      cedulaFallaCount++;
      fallasReporte.push({
        nro, id: est.id, cedula: est.cedula, nombre: est.nombre_completo,
        qr: est.qr_code, causa: 'Fallo al buscar por Cédula'
      });
      continue;
    }

    exitososCount++;
  }

  console.log("\n==================================================================");
  console.log(" RESULTADOS DE LA AUDITORÍA DE LOS ESTUDIANTES ");
  console.log("==================================================================");
  console.log(`✅ Estudiantes con lectura de QR y Cédula 100% PERFECTA: ${exitososCount} de ${todos.length}`);
  console.log(`⚠️ Estudiantes sin QR Code: ${sinQrCount}`);
  console.log(`❌ Estudiantes con falla de QR: ${qrFallaCount}`);
  console.log(`❌ Estudiantes con falla de Cédula: ${cedulaFallaCount}`);

  if (reparaciones.length > 0) {
    console.log(`\n🔧 Reparando ${reparaciones.length} estudiantes con QR faltante...`);
    for (const rep of reparaciones) {
      await sb.from('estudiantes').update({ qr_code: rep.qr_code }).eq('id', rep.id);
      console.log(`   - Reparado QR para ${rep.nombre}: ${rep.qr_code}`);
    }
  }

  if (fallasReporte.length > 0) {
    console.log("\n📋 Detalle de Fallas Encontradas:");
    console.table(fallasReporte);
  } else {
    console.log("\n🎉 ¡TODOS LOS ESTUDIANTES (100%) TIENEN LECTURA Y QR TOTALMENTE VALIDOS!");
  }
}

auditarTodosLosEstudiantes();
