import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local manualmente
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envVars[match[1]] = value.trim();
  }
});

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const key = envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!url || !key) {
  console.error("Faltan credenciales de Supabase en .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function runHardReset() {
  console.log("🚀 Iniciando Purga Controlada de Datos de Prueba (Hard Reset)...");

  const { data: inst, error: eInst } = await sb.from('instituciones').select('id, nombre').limit(1).single();
  if (eInst || !inst?.id) {
    console.error("Error al obtener institución:", eInst?.message);
    process.exit(1);
  }
  console.log(`Institución activa: ${inst.nombre} (${inst.id})`);

  const instId = inst.id;
  const eliminados = {};

  // 1. Asistencia Personal
  const { data: delAsisPer, error: e1 } = await sb
    .from('asistencia_personal')
    .delete()
    .eq('institucion_id', instId)
    .select('id');
  if (e1) console.warn('asistencia_personal:', e1.message);
  eliminados.asistencia_personal = delAsisPer?.length ?? 0;

  // 2. Pases
  const { data: delPases, error: e2 } = await sb
    .from('pases')
    .delete()
    .eq('institucion_id', instId)
    .select('id');
  if (e2) console.warn('pases:', e2.message);
  eliminados.pases = delPases?.length ?? 0;

  // 3. Asistencias de alumnos
  const { data: delAsis, error: e3 } = await sb
    .from('asistencias')
    .delete()
    .eq('institucion_id', instId)
    .select('id');
  if (e3) console.warn('asistencias:', e3.message);
  eliminados.asistencias = delAsis?.length ?? 0;

  // 4. Asistencia de materias (aula)
  const { data: delAsisMat, error: e4 } = await sb
    .from('asistencia_materia')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (e4) console.warn('asistencia_materia:', e4.message);
  eliminados.asistencia_materia = delAsisMat?.length ?? 0;

  // 5. Notas
  const { data: delNotas, error: e5 } = await sb
    .from('notas')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (e5) console.warn('notas:', e5.message);
  eliminados.notas = delNotas?.length ?? 0;

  // 6. Estudiantes
  const { data: delEst, error: e6 } = await sb
    .from('estudiantes')
    .delete()
    .eq('institucion_id', instId)
    .select('id');
  if (e6) console.error('Error eliminando estudiantes:', e6.message);
  eliminados.estudiantes = delEst?.length ?? 0;

  console.log("SUCCESS_HARD_RESET:" + JSON.stringify(eliminados));
}

runHardReset();
