import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths exempt from password protection
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icon.svg') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/manifest.json')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('hub_session_token')?.value;
  const correctPassword = process.env.APP_PASSWORD || 'english123';
  const expectedToken = 'authenticated_' + Buffer.from(correctPassword).toString('base64');

  const isAuthenticated = token && token === expectedToken;

  if (!isAuthenticated) {
    // If requesting an API, return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Acesso restrito. Faça login primeiro.' }, { status: 401 });
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
