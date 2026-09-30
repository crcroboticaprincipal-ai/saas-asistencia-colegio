/**
 * ejecutar-indices-v3.mjs
 * Ejecuta SQL DDL en Supabase usando el endpoint /sql (disponible via REST con service_role).
 * Supabase Pro/Free expone /rest/v1/ pero no /sql directamente.
 * La única forma confiable sin un PAT es usar el cliente de Node.js pg
 * con la connection string de Supabase.
 *
 * Extraemos la connection string del proyecto desde la URL del proyecto.
 * Formato de la connection string de Supabase:
 *   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 */

// El service_role JWT contiene el project ref en el campo 'ref'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idGpoZm9mZnBza3p2a2JzZ252Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4Njk5MiwiZXhwIjoyMDkzMDYyOTkyfQ.EI1ccqunh2LI9Yyb4xZkwFAKqdCr7piYl1JICv1QmQk';
const SUPABASE_URL = 'https://obtjhfoffpskzvkbsgnv.supabase.co';

// Decode JWT payload to get project ref
const payload = JSON.parse(Buffer.from(SERVICE_ROLE_KEY.split('.')[1], 'base64').toString('utf8'));
console.log('📋 Proyecto Supabase:', payload.ref);
console.log('🔑 Rol del JWT:', payload.role);

// Script SQL completo a ejecutar de una vez
// Creamos primero la función exec_sql con SECURITY DEFINER para poder ejecutar DDL
const SETUP_SQL = `
-- Crear función helper para ejecutar DDL (si no existe)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    -- Ignorar errores de "ya existe"
    RAISE NOTICE 'Ya existe: %', SQLERRM;
END;
$$;
`;

const INDICES_SQL = `
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_cedula ON estudiantes(institucion_id, cedula)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_qr ON estudiantes(institucion_id, qr_code)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_estado ON estudiantes(institucion_id, estado)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_estudiantes_grado_seccion ON estudiantes(institucion_id, grado, seccion)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_asistencias_inst_fecha ON asistencias(institucion_id, fecha DESC)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante_fecha ON asistencias(estudiante_id, fecha DESC)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_personal_inst_cedula ON personal(institucion_id, cedula)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_personal_activo ON personal(institucion_id, activo)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_asistencia_personal_fecha ON asistencia_personal(institucion_id, fecha DESC)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_asistencia_personal_pid_fecha ON asistencia_personal(personal_id, fecha DESC)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_pases_inst_fecha ON pases(institucion_id, created_at DESC)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_horarios_bloques_dia ON horarios_bloques(plantilla_id, dia_semana)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_prof_asig_personal_dia ON profesores_asignaciones(personal_id, dia_semana, hora_inicio)');
SELECT exec_sql('CREATE INDEX IF NOT EXISTS idx_prof_asig_materia_grado ON profesores_asignaciones(materia_id, grado, seccion)');
`;

// Intentar via el endpoint Supabase SQL (usado internamente por Supabase Studio)
// El endpoint es: POST https://{ref}.supabase.co/rest/v1/rpc/... no existe para DDL

// Usamos pg (PostgreSQL client) via connection string de Supabase
// Connection string de Supabase (modo Session, puerto 5432 para DDL):
//   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
// El password es el mismo que la contraseña del proyecto (no el service_role key)

// Dado que no tenemos el password de la DB directamente, usamos la Supabase REST API
// para llamar a una función que cree los índices.

// ESTRATEGIA FINAL: usar fetch al endpoint /sql que expone Supabase internamente
// usando el service_role como Authorization header + apikey

async function trySupabaseSQL(sql) {
  // Intentar endpoint interno de Supabase que usan algunas versiones
  const endpoints = [
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    `${SUPABASE_URL}/functions/v1/exec_sql`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ query: sql }),
      });
      if (res.status !== 404 && res.status !== 405) {
        return { status: res.status, ok: res.ok, body: await res.text() };
      }
    } catch { /* continuar */ }
  }
  return null;
}

// Intentar importar pg
let pgAvailable = false;
let pg;
try {
  pg = await import('pg');
  pgAvailable = true;
} catch {
  console.log('⚠️  El módulo "pg" no está instalado localmente.');
}

if (pgAvailable) {
  console.log('✅ Módulo pg disponible — intentando conexión directa...');
  // Intentar construir la connection string
  // Supabase connection pooler: postgresql://postgres.{ref}:{DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres
  // No tenemos el DB_PASSWORD por seguridad, así que no podemos usarlo aquí
  console.log('⚠️  Se necesita el password de la base de datos (diferente al service_role key).');
  console.log('   Supabase no expone el DB password via la API REST por seguridad.');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 RESULTADO: No es posible ejecutar DDL (CREATE INDEX) directamente');
console.log('   desde scripts externos sin el password de la base de datos PostgreSQL.');
console.log('   Supabase protege este acceso intencionalmente.\n');
console.log('✅ SOLUCIÓN AUTOMÁTICA: El script SQL ya está listo en:');
console.log('   → sql/optimizacion-indices.sql\n');
console.log('📌 Pasos (toma ~2 minutos):');
console.log('   1. Abre: https://supabase.com/dashboard/project/obtjhfoffpskzvkbsgnv/sql/new');
console.log('   2. Copia y pega el contenido de sql/optimizacion-indices.sql');
console.log('   3. Presiona "Run" (o Ctrl+Enter)');
console.log('   ✅ Los 14 índices se crearán en segundos.\n');
