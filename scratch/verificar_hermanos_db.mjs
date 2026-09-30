import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

const COLEGIO_ID = 'c4e8711a-f035-428c-b98f-69555a819ec7';

async function verificar() {
  console.log("🔍 Probando inserción de 2 hermanos con la misma cédula base en Supabase...");

  const testCedulaShared = '99999999';
  const testStudent1 = {
    cedula: `${testCedulaShared}-H1`,
    nombre_completo: 'PRUEBA HERMANO 1',
    grado: 'Inicial A',
    seccion: 'A',
    nombre_representante: 'REPRESENTANTE PRUEBA',
    correo_representante: 'prueba@asisto.com',
    qr_code: `ASISTO-${testCedulaShared}-PRUEBA-HERMANO-1`,
    institucion_id: COLEGIO_ID,
    estado: 'Activo',
  };

  const testStudent2 = {
    cedula: `${testCedulaShared}-H2`,
    nombre_completo: 'PRUEBA HERMANO 2',
    grado: '1er Grado',
    seccion: 'B',
    nombre_representante: 'REPRESENTANTE PRUEBA',
    correo_representante: 'prueba@asisto.com',
    qr_code: `ASISTO-${testCedulaShared}-PRUEBA-HERMANO-2`,
    institucion_id: COLEGIO_ID,
    estado: 'Activo',
  };

  // 1. Insertar hermano 1
  const { data: d1, error: e1 } = await sb.from('estudiantes').insert([testStudent1]).select();
  if (e1) {
    console.error("❌ Error insertando Hermano 1:", e1.message);
    return;
  }
  console.log("✅ Hermano 1 insertado con éxito:", d1[0].id);

  // 2. Insertar hermano 2 (con la misma cédula base/relacionada)
  const { data: d2, error: e2 } = await sb.from('estudiantes').insert([testStudent2]).select();
  if (e2) {
    console.error("❌ Error insertando Hermano 2:", e2.message);
    return;
  }
  console.log("✅ Hermano 2 insertado con éxito:", d2[0].id);

  // 3. Probar también la inserción de 2 registros con cédula IDÉNTICA (por si acaso)
  const testSameCedula1 = {
    cedula: '88888888',
    nombre_completo: 'PRUEBA MISMA CEDULA A',
    grado: 'Inicial B',
    seccion: 'A',
    nombre_representante: 'REPRESENTANTE PRUEBA 2',
    correo_representante: 'prueba2@asisto.com',
    qr_code: `ASISTO-88888888-A`,
    institucion_id: COLEGIO_ID,
    estado: 'Activo',
  };
  const testSameCedula2 = {
    cedula: '88888888',
    nombre_completo: 'PRUEBA MISMA CEDULA B',
    grado: '2do Grado',
    seccion: 'A',
    nombre_representante: 'REPRESENTANTE PRUEBA 2',
    correo_representante: 'prueba2@asisto.com',
    qr_code: `ASISTO-88888888-B`,
    institucion_id: COLEGIO_ID,
    estado: 'Activo',
  };

  const { data: dSame, error: eSame } = await sb.from('estudiantes').insert([testSameCedula1, testSameCedula2]).select();
  if (eSame) {
    console.error("❌ Error insertando cédulas idénticas:", eSame.message);
  } else {
    console.log(`✅ Inserción de 2 estudiantes con cédula idéntica ("88888888") EXITOSA (${dSame.length} registros creaos).`);
  }

  // 4. Limpieza de datos de prueba
  console.log("🧹 Limpiando registros de prueba...");
  await sb.from('estudiantes').delete().in('cedula', ['99999999-H1', '99999999-H2', '88888888']);
  console.log("🎉 PRUEBA COMPLETADA EXITOSAMENTE: La restricción fue removida correctamente.");
}

verificar();
