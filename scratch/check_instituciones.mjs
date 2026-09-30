import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function check() {
  const { data: insts, error: eInst } = await sb.from('instituciones').select('id, nombre, activo');
  console.log("Instituciones en BD:", insts, eInst);

  const { data: ests, error: eEst } = await sb.from('estudiantes').select('id, cedula, nombre_completo, institucion_id').limit(10);
  console.log("Estudiantes muestra en BD:", ests, eEst);
}

check();
