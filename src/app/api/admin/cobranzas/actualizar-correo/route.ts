import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { emailSchema, uuidSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const { estudiante_id, correo, institucion_id } = body as {
      estudiante_id?: string;
      correo?: string;
      institucion_id?: string;
    };

    if (!estudiante_id) {
      return NextResponse.json({ error: 'estudiante_id es requerido' }, { status: 400 });
    }

    const uuidParsed = uuidSchema.safeParse(estudiante_id);
    if (!uuidParsed.success) {
      return NextResponse.json({ error: 'ID de estudiante inválido' }, { status: 400 });
    }

    const emailParsed = emailSchema.safeParse(correo);
    if (!emailParsed.success) {
      return NextResponse.json({ error: 'Dirección de correo electrónico inválida' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    const targetInstitucionId = (instResult.ok && instResult.institucionId)
      ? instResult.institucionId
      : 'c4e8711a-f035-428c-b98f-69555a819ec7';

    const sb = getSupabaseAdmin();
    let query = sb
      .from('estudiantes')
      .update({
        correo_representante: emailParsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estudiante_id);

    if (targetInstitucionId) {
      query = query.eq('institucion_id', targetInstitucionId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, correo: emailParsed.data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar correo';
    console.error('[cobranzas/actualizar-correo] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
