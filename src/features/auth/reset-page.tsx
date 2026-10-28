'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Logo } from '@/components/ui/icons';
import { api, ApiError } from '@/lib/api';

/** Opened from the reset email: choose a new password, then you are signed in. */
export function ResetPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const read = () => setToken(new URLSearchParams(location.search).get('token') || '');
    read();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== again) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await api.auth.reset(token, password);
      location.href = '/';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2 text-[17px] font-semibold tracking-tight"><Logo className="size-7" /> Studytime</div>
        <h1 className="font-sans text-[24px] leading-8 font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-[14px] text-muted">You will be signed out on your other devices.</p>
        <form onSubmit={submit}>
          <Field label="New password" hint="At least 8 characters" htmlFor="rPw"><Input id="rPw" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Type it again" htmlFor="rPw2"><Input id="rPw2" type="password" autoComplete="new-password" minLength={8} required value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
          {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>}
          <Button type="submit" block size="lg" className="mt-5" loading={busy} disabled={!token}>Save and sign in</Button>
        </form>
        <Link href="/signin" className="mt-6 inline-block text-[13px] font-medium text-accent-ink hover:underline">Back to sign in</Link>
      </div>
    </div>
  );
}
