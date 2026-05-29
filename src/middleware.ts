import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'admin_session';
const LEGACY_TOKEN = 'rafael-castillo-admin-auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (pathname.startsWith('/admin')) {
    const session = request.cookies.get(COOKIE_NAME);
    const token = session?.value || '';

    // Accept the legacy token OR any new dynamic token ending with '-auth'
    const isValid = token === LEGACY_TOKEN || (token.includes('-') && token.endsWith('-auth'));

    if (!isValid) {
      // Redirect to login
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
