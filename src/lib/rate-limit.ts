/**
 * Rate limiting en memoria (ventana deslizante simple).
 *
 * Limitación honesta: en Vercel cada instancia serverless tiene su propia memoria, así que el
 * límite es "por instancia". Frena fuerza bruta casual y ráfagas, pero para garantías estrictas
 * a escala conviene un almacén compartido (Upstash Redis / Vercel KV).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Limpieza oportunista para no crecer sin límite
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  current.count += 1;
  const allowed = current.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((current.resetAt - now) / 1000),
  };
}

export const checkRateLimit = rateLimit;

/** Borra el contador (p. ej. tras un login exitoso). */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
