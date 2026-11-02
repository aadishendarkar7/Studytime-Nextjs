'use client';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { TIER_COLOR } from '@/lib/arena/types';
import { cn } from '@/lib/utils';

/**
 * The Arena has its own look, like a scoreboard under stadium lights: a dark stage in any
 * theme, heavy italic type, slanted shapes, and one strong color per mode.
 */
export const C = {
  stage: '#0d1015',
  panel: '#151a22',
  panel2: '#1b212b',
  line: '#272e3a',
  muted: '#8a93a6',
  lime: '#c6f135',
  amber: '#ffb224',
  coral: '#ff5a4a',
  sky: '#4cc2ff',
} as const;
/** One color per answer tile, in order. */
export const CHOICE_COLORS = [C.sky, C.amber, C.coral, C.lime];

/** Heavy italic uppercase, used for every Arena heading. */
export const display = 'font-black italic uppercase tracking-[-0.02em]';

export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('st-stage relative isolate overflow-hidden rounded-[16px] text-white max-sm:rounded-[12px]', className)} style={{ background: C.stage }}>
      {children}
    </div>
  );
}

/** A slanted button. `tone` sets its color; text is dark on light tones. */
export function SkewButton({ tone = C.lime, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string }) {
  return (
    <button
      type="button"
      className={cn('st-skew group relative inline-flex h-12 items-center justify-center px-6 text-[15px] text-[#0d1015] transition-[transform,filter] duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50', display, className)}
      style={{ '--tone': tone } as CSSProperties}
      {...props}
    >
      <span className="absolute inset-0 -skew-x-12 rounded-[6px] bg-[var(--tone)] shadow-[0_8px_24px_-8px_var(--tone)] transition-shadow group-hover:shadow-[0_10px_32px_-6px_var(--tone)]" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

/** The rank badge: a shield in the tier's color with a light sweeping across it. */
export function Emblem({ tier, rating, size = 112 }: { tier: string; rating?: number; size?: number }) {
  const color = TIER_COLOR[tier] ?? C.lime;
  const id = `em-${tier}-${size}`;
  return (
    <div className="st-emblem relative shrink-0" style={{ width: size, height: size * 1.12 }}>
      <svg viewBox="0 0 100 112" className="absolute inset-0 size-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.45" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.75" />
          </linearGradient>
          <clipPath id={`${id}-c`}><path d="M50 2 94 22v38c0 26-19 42-44 50C25 102 6 86 6 60V22Z" /></clipPath>
        </defs>
        <path d="M50 2 94 22v38c0 26-19 42-44 50C25 102 6 86 6 60V22Z" fill={`url(#${id}-g)`} />
        <path d="M50 12 85 28v31c0 21-15 34-35 41-20-7-35-20-35-41V28Z" fill="#0d1015" fillOpacity="0.35" />
        <g clipPath={`url(#${id}-c)`}><rect className="st-emblem-shine" x="-60" y="-10" width="28" height="140" fill="#fff" fillOpacity="0.35" transform="skewX(-20)" /></g>
      </svg>
      <div className="absolute inset-0 grid place-items-center pb-[8%] text-center">
        <span>
          <span className={cn('block leading-none text-white', display)} style={{ fontSize: size * 0.15 }}>{tier}</span>
          {rating !== undefined && <span className="tnum mt-0.5 block font-bold leading-none text-white" style={{ fontSize: size * 0.24 }}>{rating}</span>}
        </span>
      </div>
    </div>
  );
}

/** A one-off burst of slanted confetti for a win. Pure CSS, removed when done. */
export function Burst({ colors = [C.lime, C.amber, C.sky, C.coral, '#ffffff'] }: { colors?: string[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const dist = 160 + ((i * 37) % 120);
        return (
          <span
            key={i}
            className="st-burst absolute top-1/2 left-1/2 h-3 w-1.5 rounded-[1px]"
            style={{ background: colors[i % colors.length], '--dx': `${Math.cos(angle) * dist}px`, '--dy': `${Math.sin(angle) * dist * 0.7}px`, '--r': `${(i * 47) % 360}deg`, animationDelay: `${(i % 5) * 30}ms` } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

/** A big slanted index number like "01", for mode cards. */
export function Index({ n, color }: { n: number; color: string }) {
  return <span className={cn('tnum text-[44px] leading-none opacity-90', display)} style={{ color, WebkitTextStroke: `1px ${color}` }}>{String(n).padStart(2, '0')}</span>;
}

export function Initial({ name, color, size = 32, className }: { name: string; color: string; size?: number; className?: string }) {
  return <span className={cn('grid shrink-0 place-items-center rounded-full font-black text-[#0d1015]', className)} style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>{name.trim().slice(0, 1).toUpperCase() || '?'}</span>;
}
