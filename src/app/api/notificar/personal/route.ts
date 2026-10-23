import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSession, resolveInstitucion } from '@/lib/api-auth';

export async function POST(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { personal_id, tipo } = await request.json();

    if (!personal_id || !tipo) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const { data: personal, error: errorPersonal } = await supabaseAdmin
      .from('personal')
      .select('id, nombres, apellidos, correo, institucion_id')
      .eq('id', personal_id)
      .single();

    if (errorPersonal || !personal) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
    }

    const instResult = resolveInstitucion(session, personal.institucion_id);
    if (!instResult.ok) return instResult.response;

    const now = new Date();
    const fechaSQL = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const horaSQL = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);

    const { error: errorAsistencia } = await supabaseAdmin
      .from('asistencia_personal')
      .insert([{
        personal_id,
        tipo,
        fecha: fechaSQL,
        hora: horaSQL,
        institucion_id: personal.institucion_id,
        estado_evaluacion: 'completado',
      }]);

    if (errorAsistencia) {
      return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 });
  }
}
