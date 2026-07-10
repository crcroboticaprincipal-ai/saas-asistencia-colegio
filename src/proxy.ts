import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';
// Legacy token for backward compatibility during rollout
const LEGACY_TOKEN = 'rafael-castillo-admin-auth';

/**
 * Proxy — Next.js 16 replacement for middleware.ts
 * Lightweight optimistic auth check at the network boundary.
 * Only validates cookie presence/format here; actual DB auth happens in /api/auth.
 * See: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 *
 * Token format: "[rol]-[uuid]-auth"
 * e.g. "superadmin-c4e8711a-f035-428c-b98f-69555a819ec7-auth"
 * The UUID segment is validated with a strict regex to prevent manually crafted tokens
 * from bypassing this guard (e.g. "abc-xyz-auth" is now rejected).
 */

/** Matches the dynamic token format exactly: [rol]-[uuid]-auth */
const DYNAMIC_TOKEN_RE =
  /^[a-z_]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-auth$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect administrative front-end and API routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/qrono-admin')) {
    const session = request.cookies.get(COOKIE_NAME);
    const token = session?.value || '';

    // Accept: legacy hardcoded token OR new dynamic token with a valid UUID segment
    const isValid = token === LEGACY_TOKEN || DYNAMIC_TOKEN_RE.test(token);

    if (!isValid) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      } else {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/qrono-admin/:path*'],
};
