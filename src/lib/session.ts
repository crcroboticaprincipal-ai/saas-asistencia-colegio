/**
 * Sesión firmada (HMAC-SHA256) — reemplaza al antiguo token "rol-uuid-auth" que no tenía firma
 * y por lo tanto podía ser fabricado por cualquiera.
 *
 * Módulo PURO (solo Web Crypto): es seguro importarlo desde `proxy.ts` y desde Route Handlers.
 *
 * Formato del token:  base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 */

export const SESSION_COOKIE = 'asisto_session';

export type SessionKind = 'admin' | 'personal';

export interface SessionPayload {
  /** usuarios_sistema.id (admin) o personal.id (personal) */
  uid: string;
  /** superadmin | admin_institucion | director | coordinador | docente | ... */
  rol: string;
  /** institucion_id del usuario (null solo para superadmin global) */
  inst: string | null;
  kind: SessionKind;
  /** Expiración en segundos epoch */
  exp: number;
}

/** Duración de sesión por tipo de usuario (segundos). */
export const SESSION_TTL: Record<SessionKind, number> = {
  admin: 60 * 60 * 24 * 7, // 7 días
  personal: 60 * 60 * 24 * 30, // 30 días (tablets de portería/aula)
};

export const ROLES_ADMIN = ['superadmin', 'admin_institucion'] as const;

// ── Utilidades base64url ─────────────────────────────────────────────────────

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Clave HMAC ───────────────────────────────────────────────────────────────

let keyCache: { secret: string; key: Promise<CryptoKey> } | null = null;

async function resolveSecret(): Promise<string> {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length >= 32) return explicit;

  // Cero configuración: se deriva de la service_role key (que ya es secreta y solo existe en el servidor).
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) {
    // Falla cerrada: sin secreto no se firma ni se acepta ninguna sesión.
    throw new Error('SESSION_SECRET / SUPABASE_SERVICE_ROLE_KEY no configurada: no se pueden firmar sesiones.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`asisto-session-v1:${base}`));
  return toB64Url(new Uint8Array(digest));
}

async function getKey(): Promise<CryptoKey> {
  const secret = await resolveSecret();
  if (!keyCache || keyCache.secret !== secret) {
    keyCache = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    };
  }
  return keyCache.key;
}

// ── API pública ──────────────────────────────────────────────────────────────

export async function signSession(
  data: Omit<SessionPayload, 'exp'>,
  ttlSeconds: number = SESSION_TTL[data.kind],
): Promise<string> {
  const payload: SessionPayload = { ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = toB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

/** Devuelve el payload si la firma es válida y no expiró; `null` en cualquier otro caso (nunca lanza). */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  try {
    if (!token || token.length > 2048) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;

    // crypto.subtle.verify compara en tiempo constante
    const ok = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      fromB64Url(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body))) as Partial<SessionPayload>;
    if (
      typeof payload.uid !== 'string' ||
      typeof payload.rol !== 'string' ||
      (payload.kind !== 'admin' && payload.kind !== 'personal') ||
      typeof payload.exp !== 'number' ||
      (payload.inst !== null && typeof payload.inst !== 'string')
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Lee la cookie de sesión del header `Cookie` de una Request estándar. */
export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export async function getSession(request: Request): Promise<SessionPayload | null> {
  return verifySession(readSessionCookie(request));
}

/** Opciones estándar de la cookie de sesión. */
export function sessionCookieOptions(kind: SessionKind) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL[kind],
  };
}
