-- =============================================================================
-- ASISTO PLATFORM — SQL HARDENING, RLS & B-TREE INDEX OPTIMIZATION SCRIPT
-- =============================================================================
-- Ejecuta este script en el Editor SQL de tu panel de Supabase:
-- https://supabase.com/dashboard/project/obtjhfoffpskzvkbsgnv/sql/new
-- =============================================================================

-- ── 1. ACTIVACIÓN FORZOSA DE RLS (DEFENSA EN PROFUNDIDAD) ───────────────────
ALTER TABLE IF EXISTS public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estudiantes FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asistencias FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personal FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.asistencia_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asistencia_personal FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.pases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pases FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.instituciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.instituciones FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materias FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.profesores_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profesores_asignaciones FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarios_sistema FORCE ROW LEVEL SECURITY;

-- ── 2. ELIMINACIÓN DE POLÍTICAS ANÓNIMAS INSEGURAS ─────────────────────────
DROP POLICY IF EXISTS "allow_all_estudiantes" ON public.estudiantes;
DROP POLICY IF EXISTS "allow_all_asistencias" ON public.asistencias;
DROP POLICY IF EXISTS "allow_anon_read_estudiantes" ON public.estudiantes;

-- ── 3. REVOCAR PERMISOS DE EJECUCIÓN RPC A ROLES PÚBLICOS (SI EXISTEN) ─────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'exec_sql') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'check_admin_password') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_admin_password(text, text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_admin_password(text, text) TO service_role';
  END IF;
END $$;

-- ── 4. POLÍTICAS DE LECTURA BLOQUEADA PARA ANÓNIMOS (SOLO SERVICE_ROLE / BACKEND VIA REST) ─
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_estudiantes') THEN
    CREATE POLICY "service_role_all_estudiantes" ON public.estudiantes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_asistencias') THEN
    CREATE POLICY "service_role_all_asistencias" ON public.asistencias
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_personal') THEN
    CREATE POLICY "service_role_all_personal" ON public.personal
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_asistencia_personal') THEN
    CREATE POLICY "service_role_all_asistencia_personal" ON public.asistencia_personal
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_pases') THEN
    CREATE POLICY "service_role_all_pases" ON public.pases
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_instituciones') THEN
    CREATE POLICY "service_role_all_instituciones" ON public.instituciones
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. ÍNDICES COMPUESTOS B-TREE PARA ALTO RENDIMIENTO ────────────────
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_cedula ON public.estudiantes(institucion_id, cedula);
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_qr ON public.estudiantes(institucion_id, qr_code);
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_estado ON public.estudiantes(institucion_id, estado);
CREATE INDEX IF NOT EXISTS idx_estudiantes_grado_seccion ON public.estudiantes(institucion_id, grado, seccion);

CREATE INDEX IF NOT EXISTS idx_asistencias_inst_fecha ON public.asistencias(institucion_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante_fecha ON public.asistencias(estudiante_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_personal_inst_cedula ON public.personal(institucion_id, cedula);
CREATE INDEX IF NOT EXISTS idx_personal_activo ON public.personal(institucion_id, activo);

CREATE INDEX IF NOT EXISTS idx_asistencia_personal_fecha ON public.asistencia_personal(institucion_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asistencia_personal_pid_fecha ON public.asistencia_personal(personal_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pases_inst_fecha ON public.pases(institucion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prof_asig_personal_dia ON public.profesores_asignaciones(personal_id, dia_semana, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_prof_asig_materia_grado ON public.profesores_asignaciones(materia_id, grado, seccion);

-- Fin del script de blindaje
