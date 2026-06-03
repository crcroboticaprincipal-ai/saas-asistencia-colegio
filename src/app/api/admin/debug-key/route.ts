import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim().replace(/^"|"$/g, '');
        }
      }
    } catch (e) {
      console.warn('Manual reading of .env.local failed:', e);
    }
  }

  return createClient(url, key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = getAdmin();

  let decodedRole = 'unknown';
  if (key) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const payload = Buffer.from(parts[1], 'base64').toString('utf8');
        const json = JSON.parse(payload);
        decodedRole = json.role;
      }
    } catch (e) {
      decodedRole = 'error decoding: ' + String(e);
    }
  }

  // Run database checks
  let dbUser = 'unknown';
  let dbRoleSetting = 'unknown';
  let testInsertResult = 'untested';
  let testInsertError = null;

  try {
    // 1. Get current db user
    // We run a simple query using postgrest to call a custom function or query
    const { data: claims, error: claimsErr } = await sb.rpc('get_my_claims').maybeSingle();
    dbUser = claimsErr ? 'Error: ' + claimsErr.message : JSON.stringify(claims);
  } catch (e: any) {
    dbUser = 'Error calling claims: ' + e.message;
  }

  try {
    // 2. Try inserting a test student
    const { data: testData, error: testErr } = await sb
      .from('estudiantes')
      .insert([{
        cedula: 'DEBUG_TEST_TEMP',
        nombre_completo: 'DEBUG STUDENT',
        grado: '1T',
        seccion: 'A',
        nombre_representante: 'DEBUG REPRESENTANTE',
        correo_representante: 'debug@example.com',
        qr_code: 'RC-DEBUG_TEST_TEMP',
        institucion_id: 'c4e8711a-f035-428c-b98f-69555a819ec7',
        estado: 'Activo'
      }])
      .select();

    if (testErr) {
      testInsertResult = 'failed';
      testInsertError = {
        message: testErr.message,
        details: testErr.details,
        hint: testErr.hint,
        code: testErr.code
      };
    } else {
      testInsertResult = 'success';
      // clean up
      await sb.from('estudiantes').delete().eq('cedula', 'DEBUG_TEST_TEMP');
    }
  } catch (e: any) {
    testInsertResult = 'exception';
    testInsertError = { message: e.message };
  }

  return NextResponse.json({
    env_key_exists: !!key,
    decoded_key_role: decodedRole,
    database_claims: dbUser,
    test_insert_result: testInsertResult,
    test_insert_error: testInsertError
  });
}
