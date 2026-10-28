'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Icon, Logo } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const POINTS: { icon: 'pin' | 'ai' | 'calendar'; title: string; body: string }[] = [
  { icon: 'pin', title: 'Drop a Spot', body: 'Say where you are studying. Friends see it and pull up a chair.' },
  { icon: 'ai', title: 'A tutor for your classes', body: 'Ask questions or turn slides into cheat sheets and practice tests.' },
  { icon: 'calendar', title: 'A plan that fits your week', body: 'Connect your classes and get study time before every exam.' },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

export function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opts, setOpts] = useState<{ google: boolean; email: boolean; domains: string[] }>({ google: false, email: false, domains: [] });
  const [forgot, setForgot] = useState<'' | 'ask' | 'sent'>('');
  const [invite, setInvite] = useState('');
  const [next, setNext] = useState('/');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const n = q.get('next');
    const err = q.get('error');
    const go = () => {
      if (n && n.startsWith('/') && !n.startsWith('//')) setNext(n);
      if (err) setError(err);
      if (q.get('mode') === 'signup') setMode('signup');
      const inv = q.get('invite');
      if (inv) setInvite(inv);
    };
    go();
    api.auth.me().then((r) => setOpts({ google: r.google, email: r.email, domains: r.domains })).catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') await api.auth.signup(name, email, password, invite || undefined);
      else await api.auth.signin(email, password);
      location.href = next;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.auth.forgot(email);
      setForgot('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (forgot)
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-5">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2 text-[17px] font-semibold tracking-tight"><Logo className="size-7" /> Studytime</div>
          <h2 className="font-sans text-[24px] leading-8 font-semibold tracking-tight">{forgot === 'sent' ? 'Check your email' : 'Reset your password'}</h2>
          {forgot === 'sent' ? (
            <p className="mt-2 text-[14px] text-ink-2">If <strong>{email}</strong> has an account, a reset link is on its way. It expires in an hour. Check spam too.</p>
          ) : (
            <form onSubmit={sendReset}>
              <p className="mt-1 text-[14px] text-muted">We will email you a link to choose a new password.</p>
              <Field label="Email" htmlFor="fEmail"><Input id="fEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>}
              <Button type="submit" block size="lg" className="mt-5" loading={busy}>Send reset link</Button>
            </form>
          )}
          <button type="button" className="mt-6 text-[13px] font-medium text-accent-ink hover:underline" onClick={() => (setForgot(''), setError(''))}>Back to sign in</button>
        </div>
      </div>
    );

  const domainHint = opts.domains.length ? `Use your ${opts.domains.map((d) => `@${d}`).join(' or ')} email.` : '';

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-accent-soft/60 p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-2 text-[17px] font-semibold tracking-tight"><Logo className="size-7" /> Studytime</div>
        <div className="my-auto max-w-[420px]">
          <h1 className="text-[34px] leading-[42px] tracking-tight">Study with your campus, not alone in your room.</h1>
          <ul className="mt-8 grid gap-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-accent shadow-sm"><Icon name={p.icon} className="size-[18px]" /></span>
                <span><span className="block text-[15px] font-semibold">{p.title}</span><span className="block text-[14px] leading-5 text-ink-2">{p.body}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-muted">Free for students.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2 text-[17px] font-semibold tracking-tight lg:hidden"><Logo className="size-7" /> Studytime</div>
          <h2 className="font-sans text-[26px] leading-8 font-semibold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-[14px] text-muted">{mode === 'signin' ? 'Sign in to pick up where you left off.' : 'Takes a minute. Your progress follows you to every device.'}</p>

          <Segmented className="mt-6" label="Sign in or sign up" value={mode} onChange={(m) => (setMode(m), setError(''))} options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} />

          {opts.google && (
            <>
              <a href={`/api/auth/google?next=${encodeURIComponent(next)}${invite ? `&invite=${encodeURIComponent(invite)}` : ''}`} className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-[15px] font-medium hover:bg-surface-2">
                <GoogleMark /> Continue with Google
              </a>
              <div className="my-5 flex items-center gap-3 text-[12px] text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
            </>
          )}

          <form onSubmit={submit} className={cn(!opts.google && 'mt-2')}>
            {mode === 'signup' && <Field label="Your name" htmlFor="authName"><Input id="authName" autoComplete="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></Field>}
            <Field label="Email" hint={mode === 'signup' && domainHint ? domainHint : undefined} htmlFor="authEmail"><Input id="authEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {invite && mode === 'signup' && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-ink">You were invited by a friend. You will follow each other once you join.</p>}
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined} htmlFor="authPassword"><Input id="authPassword" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>}
            <Button type="submit" block size="lg" className="mt-5" loading={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
            {mode === 'signin' && <button type="button" className="mt-3 block text-[13px] font-medium text-accent-ink hover:underline" onClick={() => (setForgot('ask'), setError(''))}>Forgot your password?</button>}
          </form>

          <p className="mt-6 text-center text-[13px] text-muted">
            {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => (setMode(mode === 'signin' ? 'signup' : 'signin'), setError(''))}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button>
          </p>
          <p className="mt-8 text-center text-[12px] text-muted">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.</p>
        </div>
      </main>
    </div>
  );
}
