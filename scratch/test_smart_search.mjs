import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

function vocalWildcard(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[AEIOUN]/g, '_');
}

async function testSmartSearch() {
  const inputs = [
    'SAMUEL MARQUEZ',
    'samuel marquez',
    'SAMUEL MÁRQUEZ',
    'marquez samuel',
    'Perez Marquez',
    'MATHIAS ALCALA'
  ];

  console.log("🧪 Probando búsqueda inteligente con Wildcard de Vocales en Supabase:\n");

  for (const input of inputs) {
    const palabras = input.trim().split(/\s+/).filter(p => p.length > 1);
    let query = sb.from('estudiantes').select('cedula, nombre_completo, qr_code, grado, seccion');

    for (const pal of palabras) {
      const pattern = vocalWildcard(pal);
      query = query.ilike('nombre_completo', `%${pattern}%`);
    }

    const { data, error } = await query.limit(3);
    console.log(`Input: "${input}"`);
    console.log(`   - Patrones SQL: ${palabras.map(vocalWildcard).join(' AND ')}`);
    console.log(`   - Encontrados: ${data ? data.map(d => `${d.nombre_completo} (C.I: ${d.cedula})`).join(', ') : 'Ninguno'}`);
    console.log("------------------------------------------------------------------");
  }
}

testSmartSearch();
