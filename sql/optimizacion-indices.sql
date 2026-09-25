-- ============================================================
-- OPTIMIZACIÓN DE ÍNDICES — Sistema Asisto
-- Colegio Rafael Castillo | Ciclo 2026-2027
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre Supabase Dashboard > SQL Editor
--   2. Pega este script y presiona RUN
--   3. Compatible con bloques de transacción de Supabase SQL Editor
-- ============================================================

-- ── Tabla: estudiantes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_cedula
  ON estudiantes(institucion_id, cedula);

CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_qr
  ON estudiantes(institucion_id, qr_code);

CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_estado
  ON estudiantes(institucion_id, estado);

CREATE INDEX IF NOT EXISTS idx_estudiantes_grado_seccion
  ON estudiantes(institucion_id, grado, seccion);

-- ── Tabla: asistencias ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asistencias_inst_fecha
  ON asistencias(institucion_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante_fecha
  ON asistencias(estudiante_id, fecha DESC);

-- ── Tabla: personal ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_personal_inst_cedula
  ON personal(institucion_id, cedula);

CREATE INDEX IF NOT EXISTS idx_personal_activo
  ON personal(institucion_id, activo);

-- ── Tabla: asistencia_personal ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asistencia_personal_fecha
  ON asistencia_personal(institucion_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_asistencia_personal_pid_fecha
  ON asistencia_personal(personal_id, fecha DESC);

-- ── Tabla: pases ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pases_inst_fecha
  ON pases(institucion_id, created_at DESC);

-- ── Tabla: horarios_bloques ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_horarios_bloques_dia
  ON horarios_bloques(plantilla_id, dia_semana);

-- ── Tabla: profesores_asignaciones ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prof_asig_personal_dia
  ON profesores_asignaciones(personal_id, dia_semana, hora_inicio);

CREATE INDEX IF NOT EXISTS idx_prof_asig_materia_grado
  ON profesores_asignaciones(materia_id, grado, seccion);

-- ============================================================
-- Verificar índices creados:
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
-- ============================================================
