-- =============================================================================
-- MIGRACIÓN DE RENDIMIENTO: ÍNDICES DE BASE DE DATOS CRÍTICOS
-- Sistema Asisto — Ejecutar en el panel SQL de Supabase
-- Generado: 2026-06-01
-- =============================================================================
-- OBJETIVO: Reducir el costo de búsqueda de O(N) a O(log N) en las columnas
--           de mayor tráfico de escritura y lectura del sistema.
-- =============================================================================

-- ── TABLA: estudiantes ──────────────────────────────────────────────────────

-- Índice primario de búsqueda: cédula (usada en cada escaneo QR)
CREATE INDEX IF NOT EXISTS idx_estudiantes_cedula
    ON public.estudiantes (cedula);

-- Índice en qr_code (ruta crítica del escáner — lookup instantáneo)
CREATE INDEX IF NOT EXISTS idx_estudiantes_qr_code
    ON public.estudiantes (qr_code);

-- Índice en nombre_completo para búsquedas ILIKE del panel admin
CREATE INDEX IF NOT EXISTS idx_estudiantes_nombre_completo
    ON public.estudiantes (nombre_completo text_pattern_ops);

-- Índice compuesto para filtros de sección y estado (paneles de reporte)
CREATE INDEX IF NOT EXISTS idx_estudiantes_seccion_estado
    ON public.estudiantes (seccion, estado);

-- Índice en institucion_id para filtros multi-tenant
CREATE INDEX IF NOT EXISTS idx_estudiantes_institucion_id
    ON public.estudiantes (institucion_id);

-- ── TABLA: asistencias ──────────────────────────────────────────────────────

-- Índice compuesto: fecha + estudiante_id (consulta más frecuente del sistema)
-- Cubre: "¿cuántas asistencias tuvo X alumno en Y fecha?" — corazón del escáner
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha_estudiante
    ON public.asistencias (fecha, estudiante_id);

-- Índice por fecha solo (dashboard admin — registros de hoy)
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha
    ON public.asistencias (fecha DESC);

-- Índice por estudiante_id (historial individual del alumno)
CREATE INDEX IF NOT EXISTS idx_asistencias_estudiante_id
    ON public.asistencias (estudiante_id);

-- Índice en created_at (feed en tiempo real — ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_asistencias_created_at
    ON public.asistencias (created_at DESC);

-- ── TABLA: horarios ─────────────────────────────────────────────────────────

-- Índice compuesto: seccion_id + profesor_id (cruce más costoso del motor)
CREATE INDEX IF NOT EXISTS idx_horarios_seccion_profesor
    ON public.horarios (seccion_id, profesor_id)
    WHERE seccion_id IS NOT NULL;

-- Índice por dia_semana para filtros de horario diario
CREATE INDEX IF NOT EXISTS idx_horarios_dia
    ON public.horarios (dia_semana)
    WHERE dia_semana IS NOT NULL;

-- ── TABLA: pases ────────────────────────────────────────────────────────────

-- Índice compuesto para analytics de pases (dashboard + ranking conductual)
CREATE INDEX IF NOT EXISTS idx_pases_estudiante_fecha
    ON public.pases (estudiante_id, fecha DESC)
    WHERE estudiante_id IS NOT NULL;

-- Índice por tipo_pase para filtros del panel de conducta
CREATE INDEX IF NOT EXISTS idx_pases_tipo
    ON public.pases (tipo_pase, fecha DESC);

-- ── ESTADÍSTICAS ────────────────────────────────────────────────────────────
-- Actualizar estadísticas del planificador de consultas para que use los índices
ANALYZE public.estudiantes;
ANALYZE public.asistencias;

-- ── VERIFICACIÓN ────────────────────────────────────────────────────────────
-- Ejecuta esta consulta para confirmar que los índices fueron creados:
-- SELECT indexname, tablename, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('estudiantes', 'asistencias', 'horarios', 'pases')
-- ORDER BY tablename, indexname;
