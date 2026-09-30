import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });
const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

async function testInsert() {
  const dummy = {
    cedula: 'TEST-COL-CHECK',
    nombre_completo: 'PRUEBA COLUMNAS',
    grado: '1er Grado',
    seccion: 'A',
    nombre_representante: 'REPRESENTANTE PRUEBA',
    correo_representante: 'test@col.com',
    qr_code: 'TEST-COL-CHECK',
    institucion_id: COLEGIO_ID,
    estado: 'Activo'
  };

  const { data, error } = await sb.from('estudiantes').insert([dummy]).select();
  console.log("Resultado inserción dummy:", data, error);

  if (data && data[0]) {
    console.log("Llaves del objeto retornado:", Object.keys(data[0]));
    await sb.from('estudiantes').delete().eq('id', data[0].id);
  }
}

testInsert();
