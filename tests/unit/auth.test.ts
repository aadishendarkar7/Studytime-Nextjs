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
