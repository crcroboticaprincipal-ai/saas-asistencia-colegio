import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

console.log("URL:", url);
console.log("Key available:", !!key);

const sb = createClient(url, key, { auth: { persistSession: false } });

async function test() {
  const { data: rpcData, error: rpcErr } = await sb.rpc('exec_sql', {
    query: 'ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_cedula_key;'
  });
  console.log("RPC exec_sql result:", { rpcData, rpcErr });

  // Check table info or test duplicate insert
  const { data: ests, error: fetchErr } = await sb.from('estudiantes').select('id, cedula, qr_code, nombre_completo').limit(5);
  console.log("Sample estudiantes:", ests, fetchErr);
}

test();
