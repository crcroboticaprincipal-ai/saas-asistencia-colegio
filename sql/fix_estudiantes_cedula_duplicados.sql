-- ── CORRECCIÓN CRÍTICA EN ESTUDIANTES: HERMANOS Y CÉDULAS ESCOLARES ──
-- Elimina restricciones de unicidad sobre la cédula para permitir hermanos
-- con la misma cédula de representante. El ID (UUID) y qr_code son las claves únicas.

-- 1. Eliminar restricciones de clave única en cédula
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_cedula_key;
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_institucion_id_cedula_key;

-- 2. Asegurar que cedula sea un campo informativo e indexado (no único)
DROP INDEX IF EXISTS idx_estudiantes_cedula;
DROP INDEX IF EXISTS idx_estudiantes_inst_cedula;
CREATE INDEX IF NOT EXISTS idx_estudiantes_inst_cedula ON estudiantes(institucion_id, cedula);

-- 3. Garantizar que qr_code sea la clave única de identificación física
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_qr_code_key;
ALTER TABLE estudiantes ADD CONSTRAINT estudiantes_qr_code_key UNIQUE (qr_code);

-- 4. Crear o reemplazar la función RPC exec_sql por si se ejecuta DDL desde backend
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;
