import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { sanitizeSearch } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
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

    if (confirmacion !== 'PROMOVER') {
      return NextResponse.json(
        { error: 'Confirmación inválida. Escribe exactamente "PROMOVER" para continuar.' },
        { status: 400 },
      );
    }

    if (!accion || !institucion_id || !grado_origen || !seccion_origen) {
      return NextResponse.json(
        { error: 'Faltan parámetros obligatorios: accion, institucion_id, grado_origen, seccion_origen.' },
        { status: 400 },
      );
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;
    if (!targetInstitucionId) {
      return NextResponse.json({ error: 'Institución no válida' }, { status: 400 });
    }

    if (accion === 'promover' && (!nuevo_grado || !nueva_seccion)) {
      return NextResponse.json(
        { error: 'Para la acción "promover" debes indicar nuevo_grado y nueva_seccion.' },
        { status: 400 },
      );
    }

    let updatePayload: Record<string, string> = {};

    if (accion === 'promover') {
      updatePayload = {
        grado: sanitizeSearch(nuevo_grado as string),
        seccion: sanitizeSearch(nueva_seccion as string).toUpperCase(),
      };
    } else if (accion === 'graduar') {
      updatePayload = {
        estado: 'Graduado',
      };
    } else {
      return NextResponse.json({ error: 'Acción no reconocida. Usa "promover" o "graduar".' }, { status: 400 });
    }

    const { data, error } = await sb
      .from('estudiantes')
      .update(updatePayload)
      .eq('institucion_id', targetInstitucionId)
      .eq('grado', sanitizeSearch(grado_origen))
      .eq('seccion', sanitizeSearch(seccion_origen).toUpperCase())
      .eq('estado', 'Activo')
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
      { status: 500 },
    );
  }
}
