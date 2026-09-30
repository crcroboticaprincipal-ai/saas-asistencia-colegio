import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function testScanner() {
  console.log("🔍 Obteniendo muestra de estudiantes con QRs de la base de datos...");
  const { data: estudiantes, error } = await sb
    .from('estudiantes')
    .select('id, cedula, nombre_completo, qr_code, grado, seccion')
    .limit(5);

  if (error || !estudiantes) {
    console.error("❌ Error consultando estudiantes:", error);
    return;
  }

  console.log("📋 Estudiantes de muestra:");
  console.table(estudiantes);

  for (const est of estudiantes) {
    console.log(`\n🧪 Probando escaneo del QR: "${est.qr_code}" (Alumno: ${est.nombre_completo})`);

    // Probar búsqueda por QR exacto
    const { data: foundByQr } = await sb
      .from('estudiantes')
      .select('id, nombre_completo, qr_code, cedula')
      .eq('qr_code', est.qr_code)
      .maybeSingle();

    console.log(`   - Encontrado por QR exacto: ${foundByQr ? `✅ SÍ (${foundByQr.nombre_completo})` : '❌ NO'}`);

    // Probar búsqueda por cédula
    const { data: foundByCed } = await sb
      .from('estudiantes')
      .select('id, nombre_completo, qr_code, cedula')
      .eq('cedula', est.cedula)
      .maybeSingle();

    console.log(`   - Encontrado por Cédula (${est.cedula}): ${foundByCed ? `✅ SÍ (${foundByCed.nombre_completo})` : '❌ NO'}`);
  }
}

testScanner();
