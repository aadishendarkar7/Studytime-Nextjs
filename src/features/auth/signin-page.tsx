'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import '@fontsource-variable/bricolage-grotesque';
import { Logo } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const FEATURES = ['See who is studying where, and pull up a chair', 'An AI tutor that turns slides into practice tests', 'Post your sessions and keep each other going'];

/** Illustration of the live map: a few study spots appearing on campus paths. */
const PINS = [
  { x: 96, y: 104, label: 'Calc II', people: 3 },
  { x: 268, y: 92, label: 'Orgo', people: 2 },
  { x: 210, y: 182, label: 'STAT400', people: 4 },
  { x: 104, y: 226, label: 'Essay sprint', people: 1 },
];

function CampusMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('st-map relative overflow-hidden rounded-[22px] border border-white/10 bg-[#13241e]', compact ? 'h-[170px]' : 'h-[260px]')} aria-hidden="true">
      <svg viewBox="0 0 360 260" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <pattern id="stgrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#ffffff" strokeOpacity=".04" /></pattern>
        </defs>
        <rect width="360" height="260" fill="url(#stgrid)" />
        <path d="M-10 120 C 80 100, 120 150, 200 128 S 320 90, 380 110" fill="none" stroke="#2b4a3e" strokeWidth="14" strokeLinecap="round" />
        <path d="M150 -10 C 160 60, 120 120, 170 190 S 220 250, 230 280" fill="none" stroke="#2b4a3e" strokeWidth="10" strokeLinecap="round" />
        <rect x="236" y="18" width="78" height="56" rx="10" fill="#1d3229" />
        <rect x="24" y="40" width="70" height="44" rx="10" fill="#1d3229" />
        <rect x="186" y="150" width="96" height="58" rx="10" fill="#1d3229" />
        <circle cx="70" cy="200" r="30" fill="#1a2e26" />
      </svg>
      {PINS.map((p, i) => (
        <div key={p.label} className="st-pin absolute flex flex-col items-center" style={{ left: `${(p.x / 360) * 100}%`, top: `${(p.y / 260) * 100}%`, animationDelay: `${0.25 + i * 0.18}s` }}>
          <span className="flex items-center gap-1.5 rounded-full bg-[#f3f1ea] py-1 pr-2.5 pl-1 text-[12px] font-semibold whitespace-nowrap text-[#0e1a16] shadow-[0_6px_16px_-6px_rgba(0,0,0,.6)]">
            <span className="flex -space-x-1.5">{Array.from({ length: Math.min(3, p.people) }, (_, k) => <span key={k} className="size-4 rounded-full border-2 border-[#f3f1ea]" style={{ background: ['#3f9f72', '#7fd39a', '#c9c7c0'][k] }} />)}</span>
            {p.label}
          </span>
          <span className="h-2.5 w-0.5 bg-[#f3f1ea]" />
          <span className="relative size-2.5 rounded-full bg-[#7fd39a]">{i === 2 && <span className="st-ring absolute -inset-2 rounded-full border-2 border-[#7fd39a]" />}</span>
        </div>
      ))}
    </div>
  );
}

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
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <style>{`
        .st-display { font-family: 'Bricolage Grotesque Variable', var(--font-sans); font-variation-settings: 'opsz' 96; letter-spacing: -0.035em; }
        @keyframes st-drop { from { opacity: 0; transform: translate(-50%, calc(-100% - 14px)); } to { opacity: 1; transform: translate(-50%, -100%); } }
        @keyframes st-ring { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.2); opacity: 0; } }
        .st-pin { opacity: 0; transform: translate(-50%, -100%); animation: st-drop .55s cubic-bezier(.2,.9,.3,1.2) forwards; }
        .st-ring { animation: st-ring 2.2s ease-out 1.4s infinite; }
        @media (prefers-reduced-motion: reduce) { .st-pin { animation: none; opacity: 1; } .st-ring { animation: none; opacity: 0; } }
      `}</style>
      <aside className="relative hidden overflow-hidden bg-[#0e1a16] px-12 py-10 text-[#f3f1ea] lg:flex lg:flex-col">
        <span className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(127,211,154,.16),transparent_65%)]" />
        <Link href="/" className="relative flex items-center gap-2.5 text-[17px] font-semibold tracking-tight"><Logo className="size-9" /> Studytime</Link>
        <div className="relative my-auto max-w-[520px] py-10">
          <h1 className="st-display text-[64px] leading-[0.95] font-bold xl:text-[76px]">Study with your campus.</h1>
          <p className="mt-5 max-w-[40ch] text-[17px] leading-7 text-[#c9c7c0]">Find people studying near you, get help from an AI tutor, and make the hours count.</p>
          <div className="mt-9"><CampusMap /></div>
          <ul className="mt-7 grid gap-2.5">
            {FEATURES.map((f) => <li key={f} className="flex items-center gap-3 text-[15px] text-[#e4e2db]"><span className="size-1.5 shrink-0 rounded-full bg-[#7fd39a]" />{f}</li>)}
          </ul>
        </div>
        <p className="relative text-[13px] text-[#8fa199]">Free for students</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="-mx-5 -mt-10 mb-8 bg-[#0e1a16] px-5 pt-6 pb-5 text-[#f3f1ea] lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Logo className="size-8" /> Studytime</Link>
            <p className="st-display mt-5 text-[40px] leading-[0.95] font-bold">Study with your campus.</p>
            <div className="mt-5"><CampusMap compact /></div>
          </div>
          <h2 className="st-display text-[34px] leading-9 font-bold">{mode === 'signin' ? 'Welcome back' : 'Join Studytime'}</h2>
          <p className="mt-2 text-[15px] text-muted">{mode === 'signin' ? 'Pick up where you left off.' : 'Free. Your progress follows you to every device.'}</p>

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

          <Link href="/" className="mt-4 flex h-11 w-full items-center justify-center rounded-lg text-[14px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">Look around first, no account needed</Link>
          <p className="mt-4 text-center text-[13px] text-muted">
            {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => (setMode(mode === 'signin' ? 'signup' : 'signin'), setError(''))}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button>
          </p>
          <p className="mt-8 text-center text-[12px] text-muted">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.</p>
        </div>
      </main>
    </div>
  );
}
