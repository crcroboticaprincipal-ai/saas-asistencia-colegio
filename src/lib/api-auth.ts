import { NextResponse } from 'next/server';
import {
  getSession,
  ROLES_ADMIN,
  type SessionKind,
  type SessionPayload,
} from '@/lib/session';

export type AuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

const NO_STORE = { 'Cache-Control': 'no-store' };

export function unauthorized(message = 'No autorizado'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401, headers: NO_STORE });
}

export function forbidden(message = 'No tienes permisos para esta acción'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403, headers: NO_STORE });
}

interface RequireOptions {
  /** Tipos de sesión aceptados. Por defecto: admin y personal. */
  kinds?: SessionKind[];
  /** Roles aceptados (cualquiera de la lista). Por defecto: sin restricción de rol. */
  roles?: readonly string[];
}

/**
 * Valida la sesión firmada EN EL SERVIDOR. Cada Route Handler debe llamarlo: el proxy es solo
 * la primera barrera (defensa en profundidad), nunca la única.
 *
 *   const auth = await requireSession(request, { kinds: ['admin'] });
 *   if (!auth.ok) return auth.response;
 *   const { session } = auth;
 */
export async function requireSession(request: Request, options: RequireOptions = {}): Promise<AuthResult> {
  const session = await getSession(request);
  if (!session) return { ok: false, response: unauthorized() };
  if (options.kinds && !options.kinds.includes(session.kind)) return { ok: false, response: forbidden() };
  if (options.roles && !options.roles.includes(session.rol)) return { ok: false, response: forbidden() };
  return { ok: true, session };
}

/** Atajo: solo administradores (superadmin | admin_institucion). */
export function requireAdmin(request: Request): Promise<AuthResult> {
  return requireSession(request, { kinds: ['admin'], roles: ROLES_ADMIN });
}

/** Atajo: solo superadmin. */
export function requireSuperadmin(request: Request): Promise<AuthResult> {
  return requireSession(request, { kinds: ['admin'], roles: ['superadmin'] });
}

export function isSuperadmin(session: SessionPayload): boolean {
  return session.kind === 'admin' && session.rol === 'superadmin';
}

/**
 * Aislamiento multi-tenant: resuelve el institucion_id efectivo.
 *  - superadmin: puede operar sobre la institución solicitada (o la suya si existe).
 *  - resto: SIEMPRE su institución; un institucion_id distinto en el body/query se rechaza.
 * Devuelve `null` cuando el usuario no tiene institución asignada ni la solicita (el llamador decide).
 */
export function resolveInstitucion(
  session: SessionPayload,
  requested?: string | null,
): { ok: true; institucionId: string | null } | { ok: false; response: NextResponse } {
  const req = requested?.trim() || null;
  if (isSuperadmin(session)) return { ok: true, institucionId: req ?? session.inst };
  if (!session.inst) return { ok: false, response: forbidden('Tu usuario no tiene institución asignada') };
  if (req && req !== session.inst) return { ok: false, response: forbidden('Institución no permitida') };
  return { ok: true, institucionId: session.inst };
}
