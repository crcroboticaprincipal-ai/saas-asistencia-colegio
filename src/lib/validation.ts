import { z } from 'zod';
import { normalizarGrado, SECCIONES } from '@/lib/grados-catalogo';

/**
 * Validación de esquema y sanitización de entradas.
 * Todo input que llega de clientes pasa por aquí antes de tocar la base de datos.
 */

/** Elimina caracteres de control y espacios sobrantes. */
const cleanText = (max: number) =>
  z
    .string()
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, '').trim())
    .pipe(z.string().min(1, 'Campo requerido').max(max, `Máximo ${max} caracteres`));

export const uuidSchema = z.string().uuid('ID inválido');

/** Cédula: dígitos con prefijo opcional V-/E- y sufijo opcional -H# (hermanos). */
export const cedulaSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ''))
  .pipe(z.string().regex(/^(?:[VE]-?)?\d{4,10}(?:-H\d{1,2})?$/, 'Cédula inválida'));

/** Código QR: ASISTO-/RC-/QR- + caracteres seguros. */
export const qrCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ''))
  .pipe(z.string().min(3).max(120).regex(/^[A-Z0-9_\-]+$/, 'Código QR inválido'));

export const emailSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().max(254).email('Correo inválido'));

export const gradoSchema = cleanText(40).transform((g) => String(normalizarGrado(g) ?? g));

export const seccionSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.enum(SECCIONES as unknown as [string, ...string[]], { message: 'Sección inválida' }));

export const estudianteCreateSchema = z.object({
  cedula: cedulaSchema,
  nombre_completo: cleanText(120),
  grado: gradoSchema,
  seccion: seccionSchema,
  nombre_representante: cleanText(120),
  correo_representante: emailSchema,
  qr_code: qrCodeSchema,
  institucion_id: uuidSchema.optional(),
  estado: z.enum(['Activo', 'Inactivo', 'Retirado']).optional(),
});

export const estudianteUpdateSchema = estudianteCreateSchema.partial().extend({ id: uuidSchema });

export const loginAdminSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const scanSchema = z.object({
  qrCode: z.string().trim().min(1).max(200),
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  /** UUID generado por el cliente → idempotencia al reintentar/encolar offline */
  evento_id: z.string().uuid().optional(),
});

export const paseSchema = z.object({
  qrCode: z.string().trim().min(1).max(200),
  tipo_pase: z.enum(['ENTRADA', 'SALIDA', 'ESPECIAL']),
  motivo: z.string().trim().max(200).nullish(),
});

/** Primer mensaje legible de un ZodError. */
export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

/**
 * Sanitiza un término de búsqueda antes de interpolarlo en un filtro PostgREST `.or()/.ilike()`.
 * Elimina `, ( ) " ' \ % * _ :` y todo lo que no sea letra/número/espacio/punto/guion.
 */
export function sanitizeSearch(raw: string | null | undefined, maxLen = 60): string {
  if (!raw) return '';
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Escapa texto para insertarlo en HTML (correos). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo permite URLs https de Supabase Storage (evita imágenes/beacons arbitrarios en correos). */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
    if (u.protocol !== 'https:') return null;
    if (supa && u.host !== supa) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Redirección interna segura (evita open-redirect en `?from=`). */
export function safeInternalPath(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
  return path;
}
