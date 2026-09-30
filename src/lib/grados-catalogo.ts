/**
 * CATÁLOGO CANÓNICO DE GRADOS Y SECCIONES — Sistema Asisto
 *
 * Fuente única de verdad para todos los formularios, validadores e importadores.
 * NUNCA uses strings de grado/sección hardcodeados en ningún componente.
 * Importa siempre desde aquí.
 */

// ── Educación Inicial ──────────────────────────────────────────────────────────
export const GRADOS_INICIAL = [
  'Inicial A',
  'Inicial B',
  'Inicial C',
  '1er Nivel Inicial',
  '2do Nivel Inicial',
  '3er Nivel Inicial',
] as const;

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
  ...GRADOS_INICIAL,
  ...GRADOS_PRIMARIA,
  ...GRADOS_BACHILLERATO,
] as const;

export type GradoCanónico = (typeof TODOS_LOS_GRADOS)[number];

// ── Secciones ─────────────────────────────────────────────────────────────────
export const SECCIONES = ['A', 'B', 'C'] as const;
export type SeccionCanónica = (typeof SECCIONES)[number];

// Mapeo de sinónimos/alias flexibles a la forma canónica de grado
const ALIAS_GRADOS: Record<string, GradoCanónico> = {
  'inicial': 'Inicial A',
  'inicial a': 'Inicial A',
  'inicial b': 'Inicial B',
  'inicial c': 'Inicial C',
  '1er nivel': '1er Nivel Inicial',
  '1er nivel inicial': '1er Nivel Inicial',
  '1er nivel de inicial': '1er Nivel Inicial',
  '1er grado inicial': '1er Nivel Inicial',
  '2do nivel': '2do Nivel Inicial',
  '2do nivel inicial': '2do Nivel Inicial',
  '2do nivel de inicial': '2do Nivel Inicial',
  '2do grado inicial': '2do Nivel Inicial',
  '3er nivel': '3er Nivel Inicial',
  '3er nivel inicial': '3er Nivel Inicial',
  '3er nivel de inicial': '3er Nivel Inicial',
  '3er grado inicial': '3er Nivel Inicial',
  'maternal': 'Inicial A',
  'educacion inicial': 'Inicial A',
  'educación inicial': 'Inicial A',
};

// ── Validadores ───────────────────────────────────────────────────────────────

/** Verifica si un string es un grado válido o ingresado. Permite cualquier texto de grado no vacío. */
export function esGradoValido(grado: string): boolean {
  return typeof grado === 'string' && grado.trim().length > 0;
}

/** Normaliza un grado al formato canónico. Si no se reconoce, retorna el mismo texto limpio. */
export function normalizarGrado(input: string): GradoCanónico | string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalizado = trimmed.toLowerCase();

  // Coincidencia exacta
  const matchDirecto = (TODOS_LOS_GRADOS as readonly string[]).find(
    (g) => g.toLowerCase() === normalizado
  ) as GradoCanónico | undefined;
  if (matchDirecto) return matchDirecto;

  // Alias conocido
  if (ALIAS_GRADOS[normalizado]) {
    return ALIAS_GRADOS[normalizado];
  }

  // Heurísticas para inicial
  if (normalizado.includes('1er') && normalizado.includes('inicial')) return '1er Nivel Inicial';
  if (normalizado.includes('2do') && normalizado.includes('inicial')) return '2do Nivel Inicial';
  if (normalizado.includes('3er') && normalizado.includes('inicial')) return '3er Nivel Inicial';
  if (normalizado.includes('inicial a')) return 'Inicial A';
  if (normalizado.includes('inicial b')) return 'Inicial B';
  if (normalizado.includes('inicial c')) return 'Inicial C';
  if (normalizado.includes('inicial')) return 'Inicial A';

  return trimmed;
}

/** Verifica si una sección es válida. */
export function esSeccionValida(seccion: string): boolean {
  if (!seccion) return false;
  return (SECCIONES as readonly string[]).includes(seccion.trim().toUpperCase());
}

/**
 * Retorna el grado siguiente en el flujo de promoción.
 * Retorna 'Graduado' si el alumno completa 5to Año.
 */
export function siguienteGrado(grado: string): GradoCanónico | 'Graduado' {
  const norm = normalizarGrado(grado) ?? grado.trim();
  const idx = (TODOS_LOS_GRADOS as readonly string[]).indexOf(norm as GradoCanónico);
  if (idx === -1) return grado as GradoCanónico; // desconocido → mantener
  if (idx === TODOS_LOS_GRADOS.length - 1) return 'Graduado'; // 5to Año → graduado
  return TODOS_LOS_GRADOS[idx + 1] as GradoCanónico;
}

/**
 * Niveles para el catálogo de Materias (incluye opción General).
 */
export const NIVELES_MATERIA = [
  ...GRADOS_INICIAL,
  ...GRADOS_PRIMARIA,
  ...GRADOS_BACHILLERATO,
  'General',
] as const;
