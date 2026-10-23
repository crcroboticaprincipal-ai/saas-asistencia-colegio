import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession, ROLES_ADMIN } from '@/lib/session';

/**
 * Proxy — Next.js 16 (reemplaza a middleware.ts).
 * Primera barrera: verifica la FIRMA y expiración de la sesión (ya no solo el formato).
 * Cada Route Handler vuelve a validar con requireSession() (defensa en profundidad).
 *
 *  - /admin, /api/admin             → sesión admin (superadmin | admin_institucion)
 *  - /qrono-admin, /api/qrono-admin → solo superadmin
 *  - /escaner (excepto expo-local)  → cualquier sesión válida (admin o personal)
 *  - APIs operativas                → cualquier sesión válida (el handler afina el rol)
 */

const PUBLIC_EXCEPTIONS = ['/escaner/expo-local', '/api/notificar/expo'];

function isAdminArea(p: string) {
  return (
    p === '/admin' ||
    p.startsWith('/admin/') ||
    p.startsWith('/api/admin') ||
    p === '/dashboard' ||
    p.startsWith('/dashboard/')
  );
}
function isSuperArea(p: string) {
  return p === '/qrono-admin' || p.startsWith('/qrono-admin/') || p.startsWith('/api/qrono-admin');
}
function isAnySessionArea(p: string) {
  return (
    p === '/escaner' ||
    p.startsWith('/api/escaner') ||
    p.startsWith('/api/pases') ||
    p.startsWith('/api/aula') ||
    p.startsWith('/api/exportar') ||
    p.startsWith('/api/notificar') ||
    p.startsWith('/api/perfil')
  );
}

function deny(request: NextRequest, status: 401 | 403) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: status === 401 ? 'No autorizado' : 'Acceso denegado' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const loginUrl = new URL('/login', request.url);
  if (status === 401) loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_EXCEPTIONS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const admin = isAdminArea(pathname);
  const superArea = isSuperArea(pathname);
  const anySession = isAnySessionArea(pathname);
  if (!admin && !superArea && !anySession) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return deny(request, 401);

  if (superArea && !(session.kind === 'admin' && session.rol === 'superadmin')) return deny(request, 403);
  if (admin && !(session.kind === 'admin' && (ROLES_ADMIN as readonly string[]).includes(session.rol))) {
    return deny(request, 403);
  }

  const res = NextResponse.next();
  // Nunca cachear respuestas autenticadas en CDN/navegador compartido
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/dashboard/:path*',
    '/qrono-admin/:path*',
    '/api/qrono-admin/:path*',
    '/escaner',
    '/api/escaner/:path*',
    '/api/pases/:path*',
    '/api/aula/:path*',
    '/api/exportar/:path*',
    '/api/notificar/:path*',
    '/api/perfil/:path*',
  ],
};
