import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorage } from '@/lib/server/storage';
import { MemoryStorage } from '@/lib/server/storage/memory';
import { checkPassword, createAccount, emailAllowed, findByEmail, googleAccount, hashPassword, signIn, updateAccount } from '@/lib/server/accounts';
import { readSession, signSession } from '@/lib/session-token';

beforeEach(() => {
  setStorage(new MemoryStorage());
  vi.unstubAllEnvs();
});

describe('sessions', () => {
  it('round-trips and rejects tampering and expiry', () => {
    const t = signSession('abc', 1000);
    expect(readSession(t, 2000)).toBe('abc');
    expect(readSession(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 2000)).toBeNull();
    expect(readSession(t, 1000 + 61 * 86_400_000)).toBeNull();
    expect(readSession('junk')).toBeNull();
  });
});

describe('accounts', () => {
  it('hashes passwords', async () => {
    const h = await hashPassword('correct horse');
    expect(h).not.toContain('correct');
    expect(await checkPassword('correct horse', h)).toBe(true);
    expect(await checkPassword('wrong', h)).toBe(false);
  });

  it('signs up, signs in, and refuses duplicates and wrong passwords', async () => {
    const a = await createAccount({ email: 'Aadi@UMD.edu ', password: 'password1', name: 'Aadi' });
    expect(a.email).toBe('aadi@umd.edu');
    await expect(createAccount({ email: 'aadi@umd.edu', password: 'password2', name: 'X' })).rejects.toThrow(/already exists/);
    expect((await signIn('AADI@umd.edu', 'password1')).id).toBe(a.id);
    await expect(signIn('aadi@umd.edu', 'nope')).rejects.toThrow(/Wrong email or password/);
    await expect(signIn('nobody@umd.edu', 'password1')).rejects.toThrow(/Wrong email or password/);
  });

  it('limits sign-ups to allowed school domains', async () => {
    vi.stubEnv('ALLOWED_EMAIL_DOMAINS', 'umd.edu');
    expect(emailAllowed('a@terpmail.umd.edu')).toBe(true);
    expect(emailAllowed('a@gmail.com')).toBe(false);
    await expect(createAccount({ email: 'a@gmail.com', password: 'password1', name: 'A' })).rejects.toThrow(/umd.edu/);
  });

  it('links Google to an existing email account and saves the profile', async () => {
    const a = await createAccount({ email: 'sam@umd.edu', password: 'password1', name: 'Sam' });
    const g = await googleAccount({ sub: 'g-1', email: 'SAM@umd.edu', name: 'Sam G' });
    expect(g.id).toBe(a.id);
    const fresh = await googleAccount({ sub: 'g-2', email: 'new@umd.edu', name: 'New' });
    expect(fresh.id).not.toBe(a.id);
    await updateAccount(a.id, { profile: { school: 'UMD', courses: ['STAT400'] }, onboarded: true });
    const saved = await findByEmail('sam@umd.edu');
    expect(saved?.profile).toMatchObject({ school: 'UMD', courses: ['STAT400'] });
    expect(saved?.onboarded).toBe(true);
  });
});

describe('password reset and account deletion', () => {
  it('uses a reset token once and bumps the session version', async () => {
    const { createResetToken, consumeResetToken, setPassword } = await import('@/lib/server/accounts');
    const a = await createAccount({ email: 'r@umd.edu', password: 'password1', name: 'R' });
    const t = await createResetToken(a.id);
    expect(await consumeResetToken(t)).toBe(a.id);
    await expect(consumeResetToken(t)).rejects.toThrow(/expired/);
    const b = await setPassword(a.id, 'newpassword');
    expect(b.sv).toBe(1);
    expect(await checkPassword('newpassword', b.password)).toBe(true);
  });

  it('rejects old sessions after the password changes', async () => {
    const { requireAccount, setPassword } = await import('@/lib/server/accounts');
    const a = await createAccount({ email: 's@umd.edu', password: 'password1', name: 'S' });
    const req = (v: number) => new Request('http://x', { headers: { cookie: `st_session=${signSession(a.id, Date.now(), v)}` } });
    expect((await requireAccount(req(0))).id).toBe(a.id);
    await setPassword(a.id, 'password2');
    await expect(requireAccount(req(0))).rejects.toThrow(/sign in/);
    expect((await requireAccount(req(1))).id).toBe(a.id);
  });

  it('deletes the account so the email can sign up again', async () => {
    const { deleteAccount, getAccount } = await import('@/lib/server/accounts');
    const { removeUserSocial } = await import('@/lib/server/services/feed');
    const a = await createAccount({ email: 'd@umd.edu', password: 'password1', name: 'D' });
    await deleteAccount(a, removeUserSocial);
    expect(await getAccount(a.id)).toBeNull();
    expect(await findByEmail('d@umd.edu')).toBeNull();
    await createAccount({ email: 'd@umd.edu', password: 'password1', name: 'D2' });
  });
});

import { anyRedisUrl, setting } from '@/lib/server/env';

describe('forgiving settings', () => {
  it('strips quotes, spaces and a pasted NAME= prefix', () => {
    process.env.T_KEY = '  "GEMINI_API_KEY=abc123"  ';
    process.env.GEMINI_API_KEY_TEST = "'xyz'";
    expect(setting('T_KEY')).toBe('GEMINI_API_KEY=abc123'); // only its own name is stripped
    expect(setting('GEMINI_API_KEY_TEST')).toBe('xyz');
    process.env.T_KEY2 = 'T_KEY2=  value ';
    expect(setting('MISSING_ONE', 'T_KEY2')).toBe('value');
  });
  it('finds a Redis URL under any storage-like name', () => {
    const saved = { ...process.env };
    for (const k of ['REDIS_URL', 'KV_URL', 'STORAGE_URL', 'REDIS_TLS_URL']) delete process.env[k];
    process.env.STUDYTIME_REDIS_URL = '"redis://default:pw@host:6379"';
    expect(anyRedisUrl()).toBe('redis://default:pw@host:6379');
    process.env = saved;
  });
});
