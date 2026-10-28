import 'server-only';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookieFrom, readSessionFull, SESSION_COOKIE, SESSION_DAYS, signSession } from '@/lib/session-token';
import { HttpError } from './http';
import { secret } from './ids';
import { getStorage } from './storage';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export interface AccountProfile { school: string; major: string; year: string; courses: string[] }
export interface Account {
  id: string;
  email: string;
  name: string;
  password?: string;
  google?: string;
  createdAt: number;
  onboarded: boolean;
  profile: AccountProfile;
  /** Session version: bumping it signs the account out everywhere. */
  sv?: number;
  /** Who invited this person, and how many people they have invited. */
  invitedBy?: string;
  invites?: number;
  /** Weekly recap email. On unless turned off. */
  recapEmail?: boolean;
}
export type PublicAccount = Omit<Account, 'password' | 'google' | 'sv'> & { hasPassword: boolean; viaGoogle: boolean };

const USERS = 'users';
const EMAILS = 'user-emails';
const DATA = (id: string) => `user-data:${id}`;
const emptyProfile = (): AccountProfile => ({ school: '', major: '', year: '', courses: [] });

export const normEmail = (e: string) => e.trim().toLowerCase();

/** ALLOWED_EMAIL_DOMAINS=umd.edu,terpmail.umd.edu limits sign-ups to those schools. Subdomains count. */
export function emailAllowed(email: string) {
  const list = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  if (!list.length) return true;
  const domain = email.split('@')[1] || '';
  return list.some((d) => domain === d || domain.endsWith(`.${d}`));
}
export const allowedDomains = () => (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim()).filter(Boolean);

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scrypt(pw, salt, 64)).toString('hex')}`;
}
export async function checkPassword(pw: string, stored: string | undefined) {
  const [kind, salt, hash] = (stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const got = await scrypt(pw, salt, 64);
  const want = Buffer.from(hash, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(got, want);
}

export const publicAccount = (a: Account): PublicAccount => {
  const { password, google, sv, ...rest } = a;
  void sv;
  return { ...rest, invites: rest.invites ?? 0, recapEmail: rest.recapEmail !== false, hasPassword: Boolean(password), viaGoogle: Boolean(google) };
};

export const getAccount = (id: string) => getStorage().hget<Account>(USERS, id);
export async function findByEmail(email: string) {
  const id = await getStorage().hget<string>(EMAILS, normEmail(email));
  return id ? getAccount(id) : null;
}
const save = (a: Account) => getStorage().hset(USERS, a.id, a);

export async function createAccount(input: { email: string; password: string; name: string }) {
  const email = normEmail(input.email);
  if (!emailAllowed(email)) throw new HttpError(403, `Sign-ups are limited to ${allowedDomains().join(', ')} emails.`);
  if (await findByEmail(email)) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
  const a: Account = { id: secret(12), email, name: input.name.trim(), password: await hashPassword(input.password), createdAt: Date.now(), onboarded: false, profile: emptyProfile() };
  await save(a);
  await getStorage().hset(EMAILS, email, a.id);
  return a;
}

export async function signIn(email: string, password: string) {
  const a = await findByEmail(email);
  // Same message either way so emails cannot be probed.
  if (!a || !(await checkPassword(password, a.password))) {
    if (a && !a.password && a.google) throw new HttpError(401, 'This account uses Google. Click "Continue with Google".');
    throw new HttpError(401, 'Wrong email or password.');
  }
  return a;
}

/** Find or create the account for a verified Google identity. */
export async function googleAccount(g: { sub: string; email: string; name: string }) {
  const email = normEmail(g.email);
  const existing = await findByEmail(email);
  if (existing) {
    if (!existing.google) await save({ ...existing, google: g.sub });
    return { ...existing, google: g.sub };
  }
  if (!emailAllowed(email)) throw new HttpError(403, `Sign-ups are limited to ${allowedDomains().join(', ')} emails.`);
  const a: Account = { id: secret(12), email, name: g.name.trim().slice(0, 40) || email.split('@')[0], google: g.sub, createdAt: Date.now(), onboarded: false, profile: emptyProfile() };
  await save(a);
  await getStorage().hset(EMAILS, email, a.id);
  return a;
}

export async function updateAccount(id: string, patch: { name?: string; profile?: Partial<AccountProfile>; onboarded?: boolean; recapEmail?: boolean }) {
  const a = await getAccount(id);
  if (!a) throw new HttpError(401, 'Please sign in again.');
  const next: Account = { ...a, name: patch.name ?? a.name, onboarded: patch.onboarded ?? a.onboarded, recapEmail: patch.recapEmail ?? a.recapEmail, profile: { ...a.profile, ...(patch.profile || {}) } };
  await save(next);
  return next;
}

export const getUserData = (id: string) => getStorage().get<{ data: string; at: number }>(DATA(id));
export const setUserData = (id: string, data: string) => getStorage().set(DATA(id), { data, at: Date.now() });

/** Set a new password and sign out every other device. */
export async function setPassword(id: string, password: string) {
  const a = await getAccount(id);
  if (!a) throw new HttpError(404, 'Account not found.');
  const next: Account = { ...a, password: await hashPassword(password), sv: (a.sv ?? 0) + 1 };
  await save(next);
  return next;
}

const RESET = (hash: string) => `pw-reset:${hash}`;
const tokenHash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** A one-hour, single-use reset token. Only its hash is stored. */
export async function createResetToken(id: string) {
  const token = secret(24);
  await getStorage().set(RESET(tokenHash(token)), id, 3600);
  return token;
}
export async function consumeResetToken(token: string) {
  const key = RESET(tokenHash(token));
  const id = await getStorage().get<string>(key);
  if (!id) throw new HttpError(400, 'This reset link has expired or was already used. Ask for a new one.');
  await getStorage().del(key);
  return id;
}

/** Remove the account and everything stored with it. */
export async function deleteAccount(a: Account, extra: (id: string) => Promise<void>) {
  const s = getStorage();
  await extra(a.id);
  await s.del(DATA(a.id));
  await s.hdel(EMAILS, a.email);
  await s.hdel(USERS, a.id);
}

/** Credit the person who invited a new account. */
export async function creditInvite(inviterId: string, newId: string) {
  const inviter = await getAccount(inviterId);
  const fresh = await getAccount(newId);
  if (!inviter || !fresh || fresh.invitedBy || inviterId === newId) return null;
  await save({ ...fresh, invitedBy: inviterId });
  await save({ ...inviter, invites: (inviter.invites ?? 0) + 1 });
  return inviter;
}

// ---------- Session cookies ----------
const sessionOf = (request: Request) => readSessionFull(cookieFrom(request.headers.get('cookie'), SESSION_COOKIE));
export const sessionUserId = (request: Request) => sessionOf(request)?.u ?? null;

export async function requireAccount(request: Request) {
  const sess = sessionOf(request);
  const a = sess ? await getAccount(sess.u) : null;
  if (!a || (a.sv ?? 0) !== sess!.v) throw new HttpError(401, 'Please sign in again.');
  return a;
}

const secure = (request: Request) => new URL(request.url).protocol === 'https:';
export function sessionCookie(request: Request, userId: string, version = 0) {
  let token: string;
  try {
    token = signSession(userId, Date.now(), version);
  } catch (error) {
    throw new HttpError(500, (error as Error).message);
  }
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure(request) ? '; Secure' : ''}`;
}
export const clearCookie = (request: Request, name = SESSION_COOKIE) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(request) ? '; Secure' : ''}`;

/** JSON response that also sets cookies. */
export function withCookies(body: unknown, cookies: string[], status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}
