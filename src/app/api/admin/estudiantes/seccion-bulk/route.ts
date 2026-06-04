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

  if (!key) {
    throw new Error(
      '⚠️ Error crítico: La variable SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.'
    );
  }

  // Validate JWT role
  let role = 'unknown';
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      role = JSON.parse(payload).role;
    }
  } catch (e) {
    console.error('Error decodificando JWT:', e);
  }

  if (role !== 'service_role') {
    throw new Error(
      `⚠️ Error crítico: La llave configurada tiene el rol "${role}" en lugar de "service_role".`
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/admin/estudiantes/seccion-bulk
 *
 * Body JSON:
 * {
 *   accion: 'promover' | 'graduar',
 *   institucion_id: string,
 *   grado_origen: string,          // e.g. "1er Año"
 *   seccion_origen: string,        // e.g. "A"
 *   nuevo_grado?: string,          // required when accion === 'promover'
 *   nueva_seccion?: string,        // required when accion === 'promover'
 *   confirmacion: string           // must equal "PROMOVER"
 * }
 *
 * SAFETY GUARANTEE: Only columns `grado`, `seccion`, `estado` in the `estudiantes` table
 * are mutated. Historical attendance records (registros_asistencia, etc.) are NEVER touched.
 */
export async function POST(request: Request) {
  try {
    const sb = getAdmin();
    const body = await request.json();

    const {
      accion,
      institucion_id,
      grado_origen,
      seccion_origen,
      nuevo_grado,
      nueva_seccion,
      confirmacion,
    } = body as {
      accion: 'promover' | 'graduar';
      institucion_id: string;
      grado_origen: string;
      seccion_origen: string;
      nuevo_grado?: string;
      nueva_seccion?: string;
      confirmacion: string;
    };

    // ── Safety gate ──
    if (confirmacion !== 'PROMOVER') {
      return NextResponse.json(
        { error: 'Confirmación inválida. Escribe exactamente "PROMOVER" para continuar.' },
        { status: 400 }
      );
    }

    if (!accion || !institucion_id || !grado_origen || !seccion_origen) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios: accion, institucion_id, grado_origen, seccion_origen.' },
        { status: 400 }
      );
    }

    if (accion === 'promover' && (!nuevo_grado || !nueva_seccion)) {
      return NextResponse.json(
        { error: 'Para la acción "promover" debes indicar nuevo_grado y nueva_seccion.' },
        { status: 400 }
      );
    }

    // ── Build update payload ──
    // ONLY mutates academic assignment fields — attendance history is UNTOUCHED.
    let updatePayload: Record<string, string> = {};

    if (accion === 'promover') {
      updatePayload = {
        grado: (nuevo_grado as string).trim(),
        seccion: (nueva_seccion as string).trim().toUpperCase(),
      };
    } else if (accion === 'graduar') {
      updatePayload = {
        estado: 'Graduado',
      };
    } else {
      return NextResponse.json({ error: 'Acción no reconocida. Usa "promover" o "graduar".' }, { status: 400 });
    }

    // ── Execute atomic update ──
    // SAFETY: only `grado`, `seccion`, or `estado` fields are written.
    // Historical attendance records in other tables are never touched.
    const { data, error } = await sb
      .from('estudiantes')
      .update(updatePayload)
      .eq('institucion_id', institucion_id)
      .eq('grado', grado_origen)
      .eq('seccion', seccion_origen.toUpperCase())
      .eq('estado', 'Activo') // Only active students
      .select('id');

    if (error) throw new Error(error.message);

    const affected = data?.length ?? 0;

    return NextResponse.json({
      ok: true,
      accion,
      affected,
      message:
        accion === 'promover'
          ? `✅ ${affected} estudiante(s) promovido(s) a ${nuevo_grado} "${nueva_seccion?.toUpperCase()}" exitosamente.`
          : `🎓 ${affected} estudiante(s) marcado(s) como Graduado exitosamente.`,
    });
  } catch (err: unknown) {
    console.error('[seccion-bulk] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en operación masiva de sección.' },
      { status: 500 }
    );
  }
}
