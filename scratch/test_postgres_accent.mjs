import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function testAccentQueries() {
  console.log("🧪 Probando consultas ilike con/sin tildes en Supabase...\n");

  const q1 = await sb.from('estudiantes').select('nombre_completo').ilike('nombre_completo', '%MARQUEZ%');
  console.log("ilike '%MARQUEZ%' (sin tilde):", q1.data);

  const q2 = await sb.from('estudiantes').select('nombre_completo').ilike('nombre_completo', '%MÁRQUEZ%');
  console.log("ilike '%MÁRQUEZ%' (con tilde):", q2.data);

  const q3 = await sb.from('estudiantes').select('nombre_completo').ilike('nombre_completo', '%M_RQUEZ%');
  console.log("ilike '%M_RQUEZ%' (con _ wildcard para vocal):", q3.data);

  const q4 = await sb.from('estudiantes').select('nombre_completo').ilike('nombre_completo', '%SAMUEL%');
  console.log("ilike '%SAMUEL%':", q4.data);
}

testAccentQueries();
