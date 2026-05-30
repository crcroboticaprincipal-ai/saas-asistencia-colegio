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
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (not API routes, which protect themselves)
  if (pathname.startsWith('/admin')) {
    const session = request.cookies.get(COOKIE_NAME);
    const token = session?.value || '';

    // Accept: legacy token OR new dynamic token format "[rol]-[uuid]-auth"
    const isValid =
      token === LEGACY_TOKEN ||
      (token.includes('-') && token.endsWith('-auth') && token.length > 10);

    if (!isValid) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
