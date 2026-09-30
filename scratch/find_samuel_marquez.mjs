import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function debugAllSamuels() {
  console.log("🔍 Buscando todos los estudiantes con SAMUEL...");
  const { data: samuels } = await sb.from('estudiantes').select('id, cedula, nombre_completo, qr_code, grado, seccion').ilike('nombre_completo', '%SAMUEL%');
  console.log("Resultados SAMUEL:");
  console.table(samuels);

  console.log("\n🔍 Buscando todos los estudiantes con MÁRQUEZ (con tilde)...");
  const { data: marquezTilde } = await sb.from('estudiantes').select('id, cedula, nombre_completo, qr_code, grado, seccion').ilike('nombre_completo', '%MÁRQUEZ%');
  console.log("Resultados MÁRQUEZ:");
  console.table(marquezTilde);
}

debugAllSamuels();
