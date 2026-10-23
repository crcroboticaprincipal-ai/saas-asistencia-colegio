import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireSuperadmin } from '@/lib/api-auth';

type Status = 'ok' | 'warning' | 'error';

interface DiagnosticoResult {
  nombre: string;
  estado: Status;
  mensaje: string;
  detalle?: string;
  latencia_ms?: number;
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin(request);
  if (!auth.ok) return auth.response;

  const resultados: DiagnosticoResult[] = [];
  const sb = getSupabaseAdmin();

  // ── 1. Conexión de Base de Datos ──
  try {
    const t0 = Date.now();
    const { error } = await sb.from('instituciones').select('count', { count: 'exact', head: true });
    const latencia = Date.now() - t0;
    if (error) throw error;
    resultados.push({
      nombre: 'Base de Datos',
      estado: 'ok',
      mensaje: '🟢 Base de Datos: Conectada y Estable',
      detalle: `Latencia: ${latencia}ms`,
      latencia_ms: latencia,
    });
  } catch (err) {
    resultados.push({
      nombre: 'Base de Datos',
      estado: 'error',
      mensaje: '🔴 Base de Datos: Error de conexión',
      detalle: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 2. Servicio de Autenticación ──
  try {
    const t0 = Date.now();
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    const latencia = Date.now() - t0;
    if (error) throw error;
    void data;
    resultados.push({
      nombre: 'Autenticación',
      estado: 'ok',
      mensaje: '🟢 Sistema de PIN y Logins: Activo',
      detalle: `Auth SDK respondió en ${latencia}ms`,
      latencia_ms: latencia,
    });
  } catch (err) {
    resultados.push({
      nombre: 'Autenticación',
      estado: 'warning',
      mensaje: '🟡 Auth: Verificación limitada',
      detalle: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 3. Consistencia de Registros (Escáner) ──
  try {
    const { data: orphansEst, error: e1 } = await sb
      .from('asistencias')
      .select('id', { count: 'exact', head: false })
      .is('institucion_id', null)
      .limit(10);

    const { data: orphansPersonal, error: e2 } = await sb
      .from('asistencia_personal')
      .select('id', { count: 'exact', head: false })
      .is('institucion_id', null)
      .limit(10);

    const orphanCount = (orphansEst?.length ?? 0) + (orphansPersonal?.length ?? 0);

    if (e1 || e2) {
      resultados.push({
        nombre: 'Consistencia de Registros',
        estado: 'warning',
        mensaje: '🟡 Verificación parcial: algunas tablas no accesibles',
        detalle: 'No se pudo consultar todas las tablas de asistencia',
      });
    } else if (orphanCount > 0) {
      resultados.push({
        nombre: 'Consistencia de Registros',
        estado: 'error',
        mensaje: '🔴 Alerta: Hay registros con conflicto de ID. Solicitar revisión técnica.',
        detalle: `${orphanCount} registro(s) sin institucion_id detectados`,
      });
    } else {
      resultados.push({
        nombre: 'Consistencia de Registros',
        estado: 'ok',
        mensaje: '🟢 Consistencia: Todos los registros tienen ID de institución',
        detalle: 'Sin registros huérfanos detectados',
      });
    }
  } catch (err) {
    resultados.push({
      nombre: 'Consistencia de Registros',
      estado: 'warning',
      mensaje: '🟡 No se pudo completar la verificación',
      detalle: err instanceof Error ? err.message : 'Error desconocido',
    });
  }

  const hayError = resultados.some((r) => r.estado === 'error');
  const hayWarning = resultados.some((r) => r.estado === 'warning');
  const estadoGeneral: Status = hayError ? 'error' : hayWarning ? 'warning' : 'ok';

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    estado_general: estadoGeneral,
    resultados,
  });
}
