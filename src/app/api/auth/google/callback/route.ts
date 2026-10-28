import { connection } from 'next/server';
import { clearCookie, googleAccount, sessionCookie } from '@/lib/server/accounts';
import { HttpError } from '@/lib/server/http';
import { cookieFrom } from '@/lib/session-token';

const back = (request: Request, path: string, cookies: string[]) => {
  const headers = new Headers({ Location: new URL(path, request.url).toString(), 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
};

/** Google sends the student back here with a one-time code. */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const clearState = clearCookie(request, 'st_oauth').replace('Path=/', 'Path=/api/auth/google');
  try {
    const [state, next] = (cookieFrom(request.headers.get('cookie'), 'st_oauth') || '').split('|');
    if (!state || state !== url.searchParams.get('state')) throw new HttpError(400, 'Sign-in expired. Please try again.');
    const code = url.searchParams.get('code');
    if (!code) throw new HttpError(400, 'Google sign-in was cancelled.');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    const token = (await res.json().catch(() => ({}))) as { id_token?: string; error_description?: string };
    if (!res.ok || !token.id_token) throw new HttpError(400, token.error_description || 'Google did not confirm the sign-in.');
    // The ID token came straight from Google over HTTPS in exchange for our secret, so its claims can be trusted.
    const claims = JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; aud?: string; iss?: string };
    if (claims.aud !== process.env.GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(claims.iss || '') || !claims.sub || !claims.email || !claims.email_verified) throw new HttpError(400, 'Google did not confirm this email.');
    const account = await googleAccount({ sub: claims.sub, email: claims.email, name: claims.name || '' });
    return back(request, decodeURIComponent(next || '/') || '/', [sessionCookie(request, account.id), clearState]);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Google sign-in failed. Please try again.';
    if (!(error instanceof HttpError)) console.error(error);
    return back(request, `/signin?error=${encodeURIComponent(message)}`, [clearState]);
  }
}
