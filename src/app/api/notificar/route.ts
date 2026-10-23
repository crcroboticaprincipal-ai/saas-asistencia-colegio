import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth';
import { enviarCorreoAsistencia } from '@/lib/email';

export async function POST(request: Request) {
  const auth = await requireSession(request, { kinds: ['admin', 'personal'] });
  if (!auth.ok) return auth.response;

  try {
    const { estudiante_id, tipo } = await request.json();

    if (!estudiante_id || !tipo) {
      return NextResponse.json({ error: 'Faltan datos: estudiante_id y tipo son requeridos' }, { status: 400 });
    }

    const resultado = await enviarCorreoAsistencia({
      estudianteId: estudiante_id,
      tipo,
    });

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error || resultado.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, emailId: resultado.emailId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[notificar] Error inesperado:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
