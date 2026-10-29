'use client';
import '@fontsource/caveat/600.css';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Logo } from '@/components/ui/icons';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/* The library at night: windows light up as people sit down to study. The form is a library card. */

const COLS = 7;
const ROWS = 5;
const WINDOWS = COLS * ROWS;
/** A fixed starting pattern so the first paint looks the same on the server and in the browser. */
const START = [1, 3, 8, 9, 12, 16, 19, 22, 24, 27, 30, 33];

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

/** Someone at a desk, seen through a lit window. Varies a little per window. */
function Reader({ v }: { v: number }) {
  const lamp = v % 3 === 0;
  return (
    <svg viewBox="0 0 40 30" className="absolute inset-x-0 bottom-0 h-[78%] w-full" aria-hidden="true">
      {lamp && <path d={v % 2 ? 'M31 20v-8l-4-3M24 8h6' : 'M8 20v-8l4-3M10 8h6'} stroke="#5a3b16" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      <circle cx={v % 2 ? 17 : 22} cy="11.5" r="4.2" fill="#3a2610" />
      <path d={v % 2 ? 'M9 30c0-7 3.5-11 8-11s8 4 8 11z' : 'M14 30c0-7 3.5-11 8-11s8 4 8 11z'} fill="#3a2610" />
      <rect x="0" y="24" width="40" height="6" fill="#5a3b16" />
      {v % 4 !== 1 && <path d={v % 2 ? 'M21 24l5-6h7l-4 6z' : 'M5 24l4-6h7l-4 6z'} fill="#2a1c0b" />}
    </svg>
  );
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => (clearTimeout(first), clearInterval(id));
  }, []);
  return now;
}

/** The library: a facade of windows, a working clock, and lights that come on and off. */
function Library({ seat }: { seat: boolean }) {
  const [lit, setLit] = useState<Set<number>>(() => new Set(START));
  const now = useClock();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setLit((prev) => {
        const next = new Set(prev);
        const i = Math.floor(Math.random() * WINDOWS);
        if (next.has(i) && next.size > 8) next.delete(i);
        else next.add(i);
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, []);
  const toggle = (i: number) => setLit((prev) => new Set(prev).add(i));
  const h = now ? now.getHours() % 12 : 10;
  const m = now ? now.getMinutes() : 8;
  const s = now ? now.getSeconds() : 0;
  // The middle window on the ground floor is yours once your card is filled in.
  const mine = (ROWS - 1) * COLS + Math.floor(COLS / 2);

  return (
    <div className="relative mx-auto w-full max-w-[320px] select-none sm:max-w-[420px] lg:mx-0 lg:max-w-[440px]">
      {/* Roof with the clock */}
      <div className="relative mx-auto h-[86px] w-[86%]">
        <svg viewBox="0 0 400 86" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          <path d="M0 86 L200 4 L400 86 Z" fill="#202945" />
          <path d="M18 86 L200 14 L382 86" fill="none" stroke="#2c3759" strokeWidth="3" />
        </svg>
        <div className="absolute bottom-2 left-1/2 grid size-[58px] -translate-x-1/2 place-items-center rounded-full border-[3px] border-[#3b4772] bg-[#f6ecd2] shadow-[0_0_24px_rgba(255,214,140,.35)]" role="img" aria-label={now ? `Clock showing ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'Clock'}>
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="absolute h-1 w-[1.5px] bg-[#2a2f45]" style={{ transform: `rotate(${i * 30}deg) translateY(-22px)` }} />)}
          <span className="absolute bottom-1/2 h-[14px] w-[3px] origin-bottom rounded-full bg-[#1d2236]" style={{ transform: `rotate(${h * 30 + m / 2}deg)` }} />
          <span className="absolute bottom-1/2 h-[20px] w-[2px] origin-bottom rounded-full bg-[#1d2236]" style={{ transform: `rotate(${m * 6}deg)` }} />
          <span className="absolute bottom-1/2 h-[21px] w-px origin-bottom bg-[#b23a2a] transition-transform duration-200" style={{ transform: `rotate(${s * 6}deg)` }} />
          <span className="size-1.5 rounded-full bg-[#1d2236]" />
        </div>
      </div>
      {/* Cornice */}
      <div className="h-3 rounded-sm bg-[#2c3759]" />
      {/* Facade */}
      <div className="relative bg-[#1a2140] px-[5%] pt-5 pb-0 shadow-[inset_0_10px_30px_rgba(0,0,0,.35)]">
        <div className="grid gap-x-[3.2%] gap-y-4" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: WINDOWS }, (_, i) => {
            const isMine = i === mine;
            const on = isMine ? seat || lit.has(i) : lit.has(i);
            return (
              <div key={i} onMouseEnter={() => toggle(i)} className={cn('st-win relative aspect-[3/4] overflow-hidden rounded-t-[40%] border-2 border-[#2c3759]', isMine && seat && 'st-mine')}>
                <span className={cn('absolute inset-0 transition-opacity duration-700', on ? 'opacity-100' : 'opacity-0')} style={{ background: isMine && seat ? 'linear-gradient(#fff3c4,#ffc95c)' : 'linear-gradient(#ffe7a8,#f4b553)' }}>
                  <Reader v={i} />
                </span>
                <span className={cn('absolute inset-0 bg-[#121833] transition-opacity duration-700', on ? 'opacity-0' : 'opacity-100')} />
                <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#2c3759]" />
              </div>
            );
          })}
        </div>
        {/* Steps and door */}
        <div className="relative mx-auto mt-5 h-[52px] w-[18%] rounded-t-[50%] border-x-[3px] border-t-[3px] border-[#2c3759] bg-[#0f1430]">
          <span className="absolute inset-x-[18%] bottom-0 top-[30%] rounded-t-[40%] bg-[#ffd98a] opacity-80 shadow-[0_0_30px_rgba(255,200,110,.6)]" />
        </div>
      </div>
      <div className="h-2 bg-[#2c3759]" />
      <div className="mx-[-4%] h-2 bg-[#222b4d]" />
    </div>
  );
}

function Stars() {
  const stars = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: (i * 37.7) % 100, y: (i * 23.3) % 46, d: (i % 7) * 0.6, s: i % 5 === 0 ? 2.5 : 1.5 })), []);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {stars.map((st, i) => <span key={i} className="st-star absolute rounded-full bg-[#f6ecd2]" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />)}
    </div>
  );
}

/** A short card number from the name, so the card looks issued to you. */
const cardNo = (name: string) => String(1000 + ([...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9000, 7))).padStart(4, '0');

export function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
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
      setStamped(true);
      setTimeout(() => (location.href = next), 750);
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

  const holder = mode === 'signup' ? name.trim() : email.split('@')[0];
  const seat = Boolean(holder) && password.length >= (mode === 'signup' ? 8 : 1);
  const domainHint = opts.domains.length ? `Use your ${opts.domains.map((d) => `@${d}`).join(' or ')} email` : '';
  const line = 'w-full border-0 border-b-2 border-[#c9bb98] bg-transparent px-0 pt-1 pb-1.5 text-[16px] text-[#1f2433] outline-none transition-colors placeholder:text-[#a99b7b] focus:border-[#1f3d2f]';
  const label = 'block text-[13px] font-medium text-[#6b5f45]';

  return (
    <div className="st-night relative min-h-dvh overflow-hidden bg-[#0d1226] text-[#f6ecd2]">
      <style>{`
        .st-night { background: radial-gradient(120% 70% at 30% 0%, #1c2550 0%, #0d1226 60%); }
        .st-display { font-family: 'Fraunces Variable', Georgia, serif; font-variation-settings: 'SOFT' 100, 'WONK' 1, 'opsz' 144; letter-spacing: -0.02em; }
        .st-hand { font-family: 'Caveat', cursive; }
        @keyframes st-twinkle { 0%, 100% { opacity: .25 } 50% { opacity: 1 } }
        .st-star { animation: st-twinkle 3.2s ease-in-out infinite; }
        @keyframes st-glow { 0%, 100% { box-shadow: 0 0 18px 4px rgba(255,214,120,.55) } 50% { box-shadow: 0 0 34px 10px rgba(255,214,120,.85) } }
        .st-mine { animation: st-glow 1.6s ease-in-out infinite; border-color: #ffd98a; }
        @keyframes st-stamp { 0% { opacity: 0; transform: rotate(-14deg) scale(2.4) } 60% { opacity: .95; transform: rotate(-14deg) scale(.92) } 100% { opacity: .9; transform: rotate(-14deg) scale(1) } }
        .st-stampin { animation: st-stamp .45s cubic-bezier(.2,.9,.3,1.3) forwards; }
        @keyframes st-in { from { opacity: 0; transform: translateY(18px) rotate(1.5deg) } to { opacity: 1; transform: translateY(0) rotate(-1.2deg) } }
        .st-card { transform: rotate(-1.2deg); animation: st-in .7s cubic-bezier(.2,.8,.2,1) both .15s; }
        .st-win { transition: transform .2s; }
        .st-win:hover { transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { .st-star, .st-mine, .st-card, .st-stampin { animation: none } .st-stampin { opacity: .9; transform: rotate(-14deg) } }
      `}</style>
      <Stars />

      <div className="relative mx-auto grid min-h-dvh max-w-[1280px] items-center gap-10 px-5 py-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-10">
        {/* The scene */}
        <section className="flex flex-col">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#f6ecd2]"><Logo className="size-9" /> Studytime</Link>
          <h1 className="st-display mt-8 max-w-[14ch] text-[44px] leading-[1] font-semibold sm:text-[58px] lg:mt-8 lg:text-[62px]">The library never closes.</h1>
          <p className="mt-4 max-w-[42ch] text-[16px] leading-7 text-[#c8c3b4] sm:text-[17px]">Every lit window is someone studying. Find a seat near friends, ask the AI tutor when you&rsquo;re stuck, and post the hours you put in.</p>
          <div className="mt-8 lg:mt-10"><Library seat={seat} /></div>
        </section>

        {/* The library card */}
        <section className="relative mx-auto w-full max-w-[440px] pb-6">
          {forgot ? (
            <div className="st-card relative rounded-[6px] bg-[#f7efdc] p-7 text-[#1f2433] shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)]">
              <h2 className="st-display text-[30px] leading-9 font-semibold">{forgot === 'sent' ? 'Check your email' : 'Lost your card?'}</h2>
              {forgot === 'sent' ? (
                <p className="mt-3 text-[15px] leading-6 text-[#4a4433]">If <strong>{email}</strong> has an account, a reset link is on its way. It expires in an hour, so check spam too.</p>
              ) : (
                <form onSubmit={sendReset} className="mt-4 grid gap-5">
                  <p className="text-[15px] text-[#4a4433]">We&rsquo;ll email you a link to choose a new password.</p>
                  <label><span className={label}>Email</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={line} /></label>
                  {error && <p role="alert" className="rounded-[4px] bg-[#b23a2a]/10 px-3 py-2 text-[14px] text-[#9a2f22]">{error}</p>}
                  <button type="submit" disabled={busy} className="h-12 rounded-[4px] bg-[#1f3d2f] text-[16px] font-semibold text-[#f7efdc] transition-colors hover:bg-[#295240] disabled:opacity-60">{busy ? 'Sending' : 'Send reset link'}</button>
                </form>
              )}
              <button type="button" className="mt-5 text-[14px] font-medium text-[#1f3d2f] underline underline-offset-4" onClick={() => (setForgot(''), setError(''))}>Back to sign in</button>
            </div>
          ) : (
            <>
              {/* Folder tabs above the card */}
              <div className="relative z-10 ml-6 flex gap-1" role="tablist" aria-label="Sign in or create an account">
                {(['signin', 'signup'] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => (setMode(m), setError(''))} className={cn('rounded-t-[6px] px-4 pt-2 pb-2.5 text-[14px] font-semibold transition-colors', mode === m ? 'translate-y-[3px] bg-[#f7efdc] text-[#1f2433]' : 'bg-[#2c3759] text-[#c8c3b4] hover:text-[#f6ecd2]')}>
                    {m === 'signin' ? 'I have a card' : 'Get a card'}
                  </button>
                ))}
              </div>
              <div className="st-card relative overflow-hidden rounded-[6px] bg-[#f7efdc] text-[#1f2433] shadow-[0_30px_60px_-20px_rgba(0,0,0,.75)]">
                <div className="flex items-center justify-between bg-[#1f3d2f] px-6 py-3 text-[#f7efdc]">
                  <span className="flex items-center gap-2 text-[15px] font-semibold"><Logo className="size-6" /> Studytime library card</span>
                  <span className="tnum text-[13px] text-[#cfe3d3]">No. {holder ? cardNo(holder) : '----'}</span>
                </div>
                <span className="absolute top-[58px] right-5 size-3.5 rounded-full bg-[#0d1226] shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]" aria-hidden="true" />
                <div className="px-6 pt-4 pb-6 [background-image:repeating-linear-gradient(transparent_0_35px,rgba(160,140,100,.12)_35px_36px)]">
                  <p className="text-[13px] text-[#6b5f45]">Issued to</p>
                  <p className="st-hand min-h-[44px] truncate text-[36px] leading-[44px] text-[#23305e]">{holder || ' '}</p>

                  {opts.google && (
                    <>
                      <a href={`/api/auth/google?next=${encodeURIComponent(next)}${invite ? `&invite=${encodeURIComponent(invite)}` : ''}`} className="mt-3 flex h-11 w-full items-center justify-center gap-2.5 rounded-[4px] border-2 border-[#d8ccae] bg-white/60 text-[15px] font-medium hover:bg-white">
                        <GoogleMark /> Continue with Google
                      </a>
                      <p className="my-3 text-center text-[13px] text-[#8a7d60]">or with email</p>
                    </>
                  )}

                  <form onSubmit={submit} className="mt-3 grid gap-5">
                    {mode === 'signup' && <label><span className={label}>Your name</span><input autoComplete="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={line} /></label>}
                    <label><span className={label}>Email{mode === 'signup' && domainHint ? ` · ${domainHint}` : ''}</span><input id="authEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={line} /></label>
                    {invite && mode === 'signup' && <p className="rounded-[4px] bg-[#1f3d2f]/10 px-3 py-2 text-[14px] text-[#1f3d2f]">A friend invited you. You&rsquo;ll follow each other once you join.</p>}
                    <label><span className={label}>Password{mode === 'signup' ? ' · at least 8 characters' : ''}</span><input id="authPassword" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} className={line} /></label>
                    {error && <p role="alert" className="rounded-[4px] bg-[#b23a2a]/10 px-3 py-2 text-[14px] text-[#9a2f22]">{error}</p>}
                    <button type="submit" disabled={busy} className="h-12 rounded-[4px] bg-[#1f3d2f] text-[16px] font-semibold text-[#f7efdc] transition-colors hover:bg-[#295240] disabled:opacity-70">
                      {busy ? (stamped ? 'Welcome in' : 'Checking') : mode === 'signin' ? 'Sign in' : 'Get my card'}
                    </button>
                  </form>
                  {mode === 'signin' && <button type="button" className="mt-3 text-[14px] font-medium text-[#1f3d2f] underline-offset-4 hover:underline" onClick={() => (setForgot('ask'), setError(''))}>Forgot your password?</button>}
                </div>
                {stamped && (
                  <span className="st-stampin pointer-events-none absolute top-[38%] left-1/2 -ml-[92px] rounded-[6px] border-[4px] border-[#b23a2a] px-4 py-1.5 text-[26px] font-black tracking-wide text-[#b23a2a] uppercase opacity-0" style={{ fontFamily: 'Georgia, serif' }} aria-hidden="true">Checked in</span>
                )}
              </div>
            </>
          )}

          <Link href="/" className="mt-6 flex h-11 items-center justify-center rounded-[6px] border-2 border-[#2c3759] text-[15px] font-medium text-[#e9e3d2] transition-colors hover:border-[#ffd98a] hover:text-white">Look around first, no card needed</Link>
          <p className="mt-4 text-center text-[13px] text-[#9a9584]">By continuing you agree to the <Link href="/terms" className="underline underline-offset-4 hover:text-[#f6ecd2]">Terms</Link> and <Link href="/privacy" className="underline underline-offset-4 hover:text-[#f6ecd2]">Privacy policy</Link>.</p>
        </section>
      </div>
    </div>
  );
}
