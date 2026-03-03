import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/tracking', '/', '/admin/login'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    const decoded = Buffer.from(base64, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') ?? '';

  // track.nexora360.cloud é sempre público — redireciona raiz para /tracking
  if (hostname.startsWith('track.')) {
    if (!pathname.startsWith('/tracking')) {
      return NextResponse.redirect(new URL('/tracking', request.url));
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const token =
    request.cookies.get('nexora_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = (payload.role as string) ?? '';

  // Superadmin can only access /admin/*
  if (role === 'superadmin' && !pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // Non-superadmin trying to access /admin routes
  if (role !== 'superadmin' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Mechanic can only access /mechanic/*
  if (role === 'mechanic' && pathname !== '/mechanic' && !pathname.startsWith('/mechanic/')) {
    return NextResponse.redirect(new URL('/mechanic/orders', request.url));
  }

  // Non-mechanic trying to access /mechanic routes
  if (role !== 'mechanic' && (pathname === '/mechanic' || pathname.startsWith('/mechanic/'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|images|icons).*)',
  ],
};
