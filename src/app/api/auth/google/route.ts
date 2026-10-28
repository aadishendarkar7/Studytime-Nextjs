import { connection } from 'next/server';
import { secret } from '@/lib/server/ids';
import { handle, HttpError } from '@/lib/server/http';

/** Start "Continue with Google". Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. */
export const GET = handle(async (request: Request) => {
  await connection();
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(404, 'Google sign-in is not set up on this site.');
  const url = new URL(request.url);
  const state = secret(16);
  const next = url.searchParams.get('next');
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({ client_id: id, redirect_uri: `${url.origin}/api/auth/google/callback`, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const headers = new Headers({ Location: google.toString(), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', `st_oauth=${state}|${encodeURIComponent(safeNext)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  return new Response(null, { status: 302, headers });
});
