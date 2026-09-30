import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function testSamuelScan() {
  const inputsToTest = [
    'ASISTO-36418497-MARQUEZ-CASTILLO-SAMUEL-ORLANDO',
    '36418497',
    'V-36418497',
    'SAMUEL MARQUEZ',
    'SAMUEL MÁRQUEZ',
    'MÁRQUEZ CASTILLO SAMUEL ORLANDO',
    'MARQUEZ CASTILLO SAMUEL ORLANDO'
  ];

  console.log("🧪 Probando la búsqueda para Samuel Orlando Márquez Castillo...\n");

  for (const input of inputsToTest) {
    const raw = input.trim().toUpperCase().replace(/\s+/g, '');
    const soloNumeros = raw.replace(/^(ASISTO-|RC-|QR-|V-|E-)/, '').replace(/[^0-9]/g, '');

    // 1. qr_code
    const { data: q1 } = await sb.from('estudiantes').select('*').eq('qr_code', raw).maybeSingle();
    // 2. cedula exacta
    const { data: q2 } = await sb.from('estudiantes').select('*').eq('cedula', raw).maybeSingle();
    // 3. cedula limpia
    const { data: q3 } = soloNumeros ? await sb.from('estudiantes').select('*').eq('cedula', soloNumeros).maybeSingle() : { data: null };
    // 4. ilike por nombre
    const { data: q4 } = await sb.from('estudiantes').select('*').or(`nombre_completo.ilike.%${input.trim()}%,cedula.ilike.%${soloNumeros || input.trim()}%`).limit(1);

    const found = q1 || q2 || q3 || (q4 && q4[0]);

    console.log(`Input: "${input}"`);
    console.log(`   - Normalizado: "${raw}" | Solo números: "${soloNumeros}"`);
    console.log(`   - Encontrado en DB: ${found ? `✅ SÍ -> ${found.nombre_completo} (C.I: ${found.cedula})` : '❌ NO'}`);
  }
}

testSamuelScan();
