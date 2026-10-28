import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/session-token';

/** Everyone signs in first. The sign-in page, legal pages, API routes and files stay public. */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(readSession(request.cookies.get(SESSION_COOKIE)?.value));
  const { pathname, search } = request.nextUrl;
  if (pathname === '/signin') return signedIn ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (signedIn) return NextResponse.next();
  const to = new URL('/signin', request.url);
  if (pathname !== '/') to.searchParams.set('next', pathname + search);
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ['/((?!api|_next|privacy|terms|.*\\..*).*)'],
};
