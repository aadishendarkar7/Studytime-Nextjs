import crypto from 'node:crypto';

/** Signed session cookie: base64url({u: user id, e: expiry ms}) + "." + HMAC. Shared by the proxy and route handlers. */
export const SESSION_COOKIE = 'st_session';
export const SESSION_DAYS = 60;

export const NO_SECRET = 'Accounts are not switched on for this site yet. You can still use everything else without one.';
const DEV_SECRET = 'studytime-local-dev-secret';

/**
 * The key that signs sign-in cookies. AUTH_SECRET if it is set; otherwise one
 * derived from the database password, which is just as private and already set
 * once a database is connected. Local development uses a fixed test secret.
 */
export function authSecret() {
  const s = process.env.AUTH_SECRET?.trim().replace(/^["']|["']$/g, '');
  if (s) return s;
  const db = Object.entries(process.env).find(([k, v]) => /REDIS|KV/i.test(k) && v && /^["']?rediss?:\/\//.test(v.trim()))?.[1] || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (db) return crypto.createHash('sha256').update(`studytime-session:${db.trim()}`).digest('base64url');
  return process.env.NODE_ENV === 'production' ? '' : DEV_SECRET;
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const mac = (body: string, secret: string) => crypto.createHmac('sha256', secret).update(body).digest('base64url');

export function signSession(userId: string, now = Date.now(), version = 0) {
  const secret = authSecret();
  if (!secret) throw new Error(NO_SECRET);
  const body = b64(JSON.stringify({ u: userId, e: now + SESSION_DAYS * 86_400_000, v: version }));
  return `${body}.${mac(body, secret)}`;
}

/** The user id in a valid, unexpired session token, or null. */
export function readSession(token: string | undefined | null, now = Date.now()): string | null {
  return readSessionFull(token, now)?.u ?? null;
}

/** User id and session version (bumped when the password changes, which signs out other devices). */
export function readSessionFull(token: string | undefined | null, now = Date.now()): { u: string; v: number } | null {
  const secret = authSecret();
  if (!token || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = mac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, e, v } = JSON.parse(Buffer.from(body, 'base64url').toString()) as { u?: unknown; e?: unknown; v?: unknown };
    return typeof u === 'string' && typeof e === 'number' && e > now ? { u, v: typeof v === 'number' ? v : 0 } : null;
  } catch {
    return null;
  }
}

/** A cookie value from a raw Cookie header. */
export function cookieFrom(header: string | null, name: string) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
