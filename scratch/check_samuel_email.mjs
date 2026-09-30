import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

async function checkSamuel() {
  const { data: est } = await sb
    .from('estudiantes')
    .select('id, nombre_completo, cedula, correo_representante, nombre_representante')
    .ilike('nombre_completo', '%SAMUEL%ORLANDO%')
    .maybeSingle();

  console.log("Samuel Orlando Márquez en BD:", est);
}

checkSamuel();
