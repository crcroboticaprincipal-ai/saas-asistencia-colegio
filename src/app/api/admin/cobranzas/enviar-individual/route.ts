import { NextResponse } from 'next/server';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { enviarCorreoCobranza } from '@/lib/email';
import { sanitizeSearch } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const {
      correo,
      nombreEstudiante,
      nombreRepresentante,
      grado,
      seccion,
      conceptoMeses,
      montoCuotas,
      montoMora,
      observacion,
      institucion_id,
    } = body as {
      correo?: string;
      nombreEstudiante?: string;
      nombreRepresentante?: string;
      grado?: string;
      seccion?: string;
      conceptoMeses?: string;
      montoCuotas?: number | string;
      montoMora?: number | string;
      observacion?: string;
      institucion_id?: string;
    };

    if (!correo || !correo.includes('@')) {
      return NextResponse.json({ error: 'Dirección de correo electrónico requerida e inválida' }, { status: 400 });
    }

    if (!nombreEstudiante?.trim()) {
      return NextResponse.json({ error: 'Nombre del estudiante requerido' }, { status: 400 });
    }

    const cuotasNum = Number(montoCuotas);
    if (isNaN(cuotasNum) || cuotasNum <= 0) {
      return NextResponse.json({ error: 'El monto de cuotas debe ser mayor a 0' }, { status: 400 });
    }

    const moraNum = Number(montoMora) || 0;
    const total = cuotasNum + moraNum;

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId ?? undefined;

    const resultado = await enviarCorreoCobranza({
      destinatario: correo.trim().toLowerCase(),
      datos: {
        nombreRepresentante: sanitizeSearch(nombreRepresentante || 'Representante'),
        nombreEstudiante: sanitizeSearch(nombreEstudiante),
        grado: grado ? sanitizeSearch(grado) : '',
        seccion: sanitizeSearch(seccion || ''),
        conceptoMeses: sanitizeSearch(conceptoMeses || 'Mensualidad Escolar'),
        montoCuotas: cuotasNum,
        montoMora: moraNum,
        totalPendiente: total,
        observacion: observacion ? sanitizeSearch(observacion) : undefined,
      },
      institucionId: targetInstitucionId,
    });

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error || 'Error al despachar correo' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, emailId: resultado.emailId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al enviar cobranza';
    console.error('[cobranza/individual] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
