import { NextRequest, NextResponse } from 'next/server';
import { createRequestId } from './lib/api-errors';
import { getAuthConfig, verifySessionToken } from './lib/session';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths exempt from password protection
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icon.svg') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/manifest.json')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hub_session_token')?.value;
  const authConfig = getAuthConfig();
  const isAuthenticated = Boolean(authConfig && await verifySessionToken(token, authConfig.sessionSecret));

  if (!isAuthenticated) {
    // If requesting an API, return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      const requestId = createRequestId();
      return NextResponse.json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Acesso restrito. Faça login primeiro.',
          requestId
        }
      }, { status: 401, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } });
    }

    // If requesting a page, redirect to /login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
