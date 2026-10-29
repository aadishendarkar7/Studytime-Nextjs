import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/session-token';

/**
 * Anyone can use the site without an account. The only redirect: someone
 * already signed in who opens the sign-in page goes back into the app.
 */
export function proxy(request: NextRequest) {
  if (readSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const next = request.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/signin'],
};
