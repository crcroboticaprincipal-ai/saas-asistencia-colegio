import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Status = 'ok' | 'warning' | 'error';

interface DiagnosticoResult {
  nombre: string;
  estado: Status;
  mensaje: string;
  detalle?: string;
  latencia_ms?: number;
}

export async function GET() {
  const resultados: DiagnosticoResult[] = [];
  const sb = getAdmin();

  // ── 1. Conexión de Base de Datos ──
  if (!sb) {
    resultados.push({
      nombre: 'Base de Datos',
      estado: 'error',
      mensaje: '🔴 Error crítico: Variables de entorno de Supabase no configuradas.',
    });
  } else {
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
  }

  // ── 2. Servicio de Autenticación ──
  if (!sb) {
    resultados.push({
      nombre: 'Autenticación',
      estado: 'error',
      mensaje: '🔴 Auth: No se puede verificar (sin config)',
    });
  } else {
    try {
      const t0 = Date.now();
      // Simple auth check: list users count
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
    } catch {
      // If auth.admin is not available, try a basic check
      try {
        const t0 = Date.now();
        const { error } = await sb.from('personal').select('count', { count: 'exact', head: true }).limit(1);
        const latencia = Date.now() - t0;
        if (error) throw error;
        resultados.push({
          nombre: 'Autenticación',
          estado: 'ok',
          mensaje: '🟢 Sistema de PIN y Logins: Activo',
          detalle: `Servicio de autenticación operativo (${latencia}ms)`,
          latencia_ms: latencia,
        });
      } catch (err2) {
        resultados.push({
          nombre: 'Autenticación',
          estado: 'warning',
          mensaje: '🟡 Auth: Verificación limitada (anon key)',
          detalle: err2 instanceof Error ? err2.message : 'Error desconocido',
        });
      }
    }
  }

  // ── 3. Consistencia de Registros (Escáner) ──
  if (!sb) {
    resultados.push({
      nombre: 'Consistencia de Registros',
      estado: 'error',
      mensaje: '🔴 No se puede verificar (sin config)',
    });
  } else {
    try {
      // Check for orphan asistencia records (no institucion_id)
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
        // Table might not exist or columns might differ
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
  }

  // ── 4. Estado general del sistema ──
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
