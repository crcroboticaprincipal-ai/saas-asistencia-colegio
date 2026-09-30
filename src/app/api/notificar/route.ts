import { NextResponse } from 'next/server';
import { enviarCorreoAsistencia } from '@/lib/email';

// Este endpoint SOLO envía el correo de notificación.
// El registro de asistencia ya fue hecho por /api/escaner/validar.
export async function POST(request: Request) {
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

