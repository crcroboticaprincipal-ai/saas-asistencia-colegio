/**
 * CATÁLOGO CANÓNICO DE GRADOS Y SECCIONES — Sistema Asisto
 *
 * Fuente única de verdad para todos los formularios, validadores e importadores.
 * NUNCA uses strings de grado/sección hardcodeados en ningún componente.
 * Importa siempre desde aquí.
 */

// ── Primaria ──────────────────────────────────────────────────────────────────
export const GRADOS_PRIMARIA = [
  '1er Grado',
  '2do Grado',
  '3er Grado',
  '4to Grado',
  '5to Grado',
  '6to Grado',
] as const;

// ── Bachillerato ──────────────────────────────────────────────────────────────
export const GRADOS_BACHILLERATO = [
  '1er Año',
  '2do Año',
  '3er Año',
  '4to Año',
  '5to Año',
] as const;

// ── Todos los grados ──────────────────────────────────────────────────────────
export const TODOS_LOS_GRADOS = [
  ...GRADOS_PRIMARIA,
  ...GRADOS_BACHILLERATO,
] as const;

export type GradoCanónico = (typeof TODOS_LOS_GRADOS)[number];

// ── Secciones ─────────────────────────────────────────────────────────────────
export const SECCIONES = ['A', 'B'] as const;
export type SeccionCanónica = (typeof SECCIONES)[number];

// ── Validadores ───────────────────────────────────────────────────────────────

/** Verifica si un string es un grado canónico válido (case-insensitive). */
export function esGradoValido(grado: string): boolean {
  const normalizado = grado.trim().toLowerCase();
  return (TODOS_LOS_GRADOS as readonly string[]).some(
    (g) => g.toLowerCase() === normalizado
  );
}

/** Normaliza un grado al formato canónico. Retorna null si no encuentra match. */
export function normalizarGrado(input: string): GradoCanónico | null {
  const normalizado = input.trim().toLowerCase();
  return (
    (TODOS_LOS_GRADOS as readonly string[]).find(
      (g) => g.toLowerCase() === normalizado
    ) as GradoCanónico | undefined
  ) ?? null;
}

/** Verifica si una sección es válida. */
export function esSeccionValida(seccion: string): boolean {
  return (SECCIONES as readonly string[]).includes(seccion.trim().toUpperCase());
}

/**
 * Retorna el grado siguiente en el flujo de promoción.
 * Retorna 'Graduado' si el alumno completa 5to Año.
 * Retorna el mismo grado si no se reconoce (caso seguro).
 */
export function siguienteGrado(grado: string): GradoCanónico | 'Graduado' {
  const idx = (TODOS_LOS_GRADOS as readonly string[]).indexOf(grado.trim());
  if (idx === -1) return grado as GradoCanónico; // desconocido → mantener
  if (idx === TODOS_LOS_GRADOS.length - 1) return 'Graduado'; // 5to Año → graduado
  return TODOS_LOS_GRADOS[idx + 1] as GradoCanónico;
}

/**
 * Niveles para el catálogo de Materias (incluye opción General).
 */
export const NIVELES_MATERIA = [
  ...GRADOS_PRIMARIA,
  ...GRADOS_BACHILLERATO,
  'General',
] as const;
