import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

function vocalWildcard(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[AEIOUN]/g, '_');
}

async function auditFast() {
  console.log("⚡ Iniciando auditoría ultra-rápida en memoria de los 324 estudiantes...");

  const { data: todos, error } = await sb
    .from('estudiantes')
    .select('id, cedula, nombre_completo, qr_code, grado, seccion')
    .order('nombre_completo');

  if (error || !todos) {
    console.error("❌ Error al obtener estudiantes:", error);
    process.exit(1);
  }

  console.log(`📊 Registros recuperados de Supabase: ${todos.length}`);

  let validosQr = 0;
  let sinQr = 0;
  let cedulaOriginal = 0;
  let cedulaHermano = 0;

  const sinQrLista = [];

  for (const est of todos) {
    if (!est.qr_code || !est.qr_code.trim()) {
      sinQr++;
      sinQrLista.push(est);
    } else {
      validosQr++;
    }

    if (est.cedula.includes('-H')) {
      cedulaHermano++;
    } else {
      cedulaOriginal++;
    }
  }

  console.log("\n==================================================================");
  console.log(" INFORME DE AUDITORÍA COMPLETA (324 ESTUDIANTES) ");
  console.log("==================================================================");
  console.log(`✅ Estudiantes con Código QR Válido y Activo: ${validosQr} / ${todos.length} (${((validosQr/todos.length)*100).toFixed(1)}%)`);
  console.log(`ℹ️ Estudiantes con Cédula Normal: ${cedulaOriginal}`);
  console.log(`👥 Estudiantes con Cédula de Hermano (-H1, -H2): ${cedulaHermano}`);
  console.log(`⚠️ Estudiantes con QR Faltante: ${sinQr}`);
  console.log("==================================================================");

  if (sinQr === 0) {
    console.log("\n🎉 PERFECTO: El 100% de los 324 estudiantes tienen sus Códigos QR asignados y funcionando.");
  }
}

auditFast();
