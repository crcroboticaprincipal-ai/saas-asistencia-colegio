import { NextResponse } from 'next/server';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { enviarCorreoCobranza } from '@/lib/email';
import { sanitizeSearch } from '@/lib/validation';

interface ItemLote {
  correo: string;
  nombreEstudiante: string;
  nombreRepresentante?: string;
  grado?: string;
  seccion: string;
  conceptoMeses: string;
  montoCuotas: number;
  montoMora?: number;
  observacion?: string;
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const { items, institucion_id } = body as { items?: ItemLote[]; institucion_id?: string };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Lista de envíos vacía' }, { status: 400 });
    }

    if (items.length > 500) {
      return NextResponse.json({ error: 'Límite de 500 correos por lote' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId ?? undefined;

    const resultados: Array<{
      estudiante: string;
      correo: string;
      seccion: string;
      total: number;
      ok: boolean;
      emailId?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cuotasNum = Number(item.montoCuotas) || 0;
      const moraNum = Number(item.montoMora) || 0;
      const total = cuotasNum + moraNum;

      if (!item.correo || !item.correo.includes('@') || cuotasNum <= 0) {
        resultados.push({
          estudiante: item.nombreEstudiante,
          correo: item.correo,
          seccion: item.seccion,
          total,
          ok: false,
          error: 'Datos incompletos o correo inválido',
        });
        continue;
      }

      // Pausa controlada de 300 ms entre cada mensaje para respetar rate limits
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 300));
      }

      const resEnvio = await enviarCorreoCobranza({
        destinatario: item.correo.trim().toLowerCase(),
        datos: {
          nombreRepresentante: sanitizeSearch(item.nombreRepresentante || 'Representante'),
          nombreEstudiante: sanitizeSearch(item.nombreEstudiante),
          grado: item.grado ? sanitizeSearch(item.grado) : '',
          seccion: sanitizeSearch(item.seccion || ''),
          conceptoMeses: sanitizeSearch(item.conceptoMeses || 'Mensualidad Escolar'),
          montoCuotas: cuotasNum,
          montoMora: moraNum,
          totalPendiente: total,
          observacion: item.observacion ? sanitizeSearch(item.observacion) : undefined,
        },
        institucionId: targetInstitucionId,
      });

      resultados.push({
        estudiante: item.nombreEstudiante,
        correo: item.correo,
        seccion: item.seccion,
        total,
        ok: resEnvio.ok,
        emailId: resEnvio.emailId,
        error: resEnvio.error,
      });
    }

    const exitosos = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      resumen: {
        total: items.length,
        exitosos,
        fallidos,
      },
      resultados,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar lote de cobranza';
    console.error('[cobranza/lote] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
