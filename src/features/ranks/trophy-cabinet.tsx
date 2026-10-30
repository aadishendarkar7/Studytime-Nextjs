'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TIER_NAME, type Tier, type Trophy } from './achievements';

const METAL: Record<Exclude<Tier, 0>, [string, string, string]> = {
  1: ['#f2c299', '#c27a45', '#7a4420'],
  2: ['#ffffff', '#c3c9cf', '#7c848d'],
  3: ['#fff1b8', '#e9b93a', '#9a6a08'],
};

/** A trophy cup. Locked ones are a dark outline on the shelf. */
export function Cup({ tier, size = 56, id }: { tier: Tier; size?: number; id: string }) {
  const g = `cup-${id}`;
  if (tier === 0)
    return (
      <svg viewBox="0 0 48 56" width={size} height={size * (56 / 48)} aria-hidden="true">
        <path d="M14 6h20v12a10 10 0 0 1-20 0zM14 9H8a6 6 0 0 0 6 9M34 9h6a6 6 0 0 1-6 9M24 28v9M17 46h14l-2-9H19z" fill="#2b2f34" stroke="#3b4047" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="13" y="46" width="22" height="5" rx="1.5" fill="#2b2f34" stroke="#3b4047" strokeWidth="1.5" />
        <path d="M21 17.5v-2a3 3 0 0 1 6 0v2" fill="none" stroke="#4a5058" strokeWidth="1.6" />
        <rect x="19.5" y="17.5" width="9" height="7" rx="1.5" fill="#4a5058" />
      </svg>
    );
  const [hi, mid, lo] = METAL[tier];
  return (
    <svg viewBox="0 0 48 56" width={size} height={size * (56 / 48)} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={hi} /><stop offset=".45" stopColor={mid} /><stop offset="1" stopColor={lo} /></linearGradient>
      </defs>
      <path d="M14 9H8a6 6 0 0 0 6 9M34 9h6a6 6 0 0 1-6 9" fill="none" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" />
      <path d="M13 5h22v13a11 11 0 0 1-22 0z" fill={`url(#${g})`} />
      <path d="M17 8v9a7 7 0 0 0 3 5.8" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <path d="M21.5 28.5h5v8h-5z" fill={mid} />
      <path d="M17 46h14l-2.5-9.5h-9z" fill={`url(#${g})`} />
      <rect x="12" y="46" width="24" height="6" rx="1.5" fill={lo} />
      <rect x="16" y="47.6" width="16" height="2.4" rx="1" fill={hi} opacity=".5" />
      {tier === 3 && <path d="M24 10.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff" opacity=".85" />}
    </svg>
  );
}

function Shelf({ title, items, selected, onPick }: { title: string; items: Trophy[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <div>
      <p className="mb-1 px-1 text-[11px] font-semibold tracking-[0.08em] text-[#8b9199] uppercase">{title}</p>
      <div className="grid grid-cols-4 items-end gap-1 px-1 sm:gap-3">
        {items.map((t) => (
          <button key={t.id} type="button" onClick={() => onPick(t.id)} aria-pressed={selected === t.id} aria-label={`${t.title}: ${TIER_NAME[t.tier]}`} className={cn('group relative flex flex-col items-center rounded-lg pt-2 pb-1 transition-colors', selected === t.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]')}>
            {t.tier === 3 && <span className="pointer-events-none absolute top-1 left-1/2 size-14 -translate-x-1/2 rounded-full bg-[#ffd76a] opacity-20 blur-xl" />}
            <span className="relative"><Cup tier={t.tier} id={t.id} /></span>
            <span className={cn('mt-1 line-clamp-1 text-[12px] font-medium', t.tier ? 'text-[#e8e6e1]' : 'text-[#6c727a]')}>{t.title}</span>
          </button>
        ))}
      </div>
      <div className="relative mt-0.5 h-3 rounded-[3px] bg-gradient-to-b from-[#4a4f56] to-[#2c3035] shadow-[0_8px_14px_-4px_rgba(0,0,0,0.7)]">
        <span className="absolute inset-x-0 top-0 h-px bg-white/20" />
      </div>
    </div>
  );
}

/** Every trophy on glass shelves, grouped by area. Tap one to see what the next level needs. */
export function TrophyCabinet({ list, extra }: { list: Trophy[]; extra?: { title: string; items: Trophy[] } }) {
  const [sel, setSel] = useState<string | null>(null);
  const all = extra ? [...list, ...extra.items] : list;
  const picked = all.find((t) => t.id === sel) ?? null;
  const groups = [...new Set(list.map((t) => t.group))];
  const golds = all.filter((t) => t.tier === 3).length;
  const earned = all.filter((t) => t.tier > 0).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2c3035] bg-[#141619] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <p className="text-[15px] font-semibold text-[#f1efe9]">Trophy case</p>
        <p className="tnum text-[13px] text-[#a1a7ae]">{earned} of {all.length} · <span className="text-[#e9b93a]">{golds} gold</span></p>
      </div>
      <div className="relative grid gap-6 bg-[radial-gradient(120%_70%_at_50%_0%,#262a2f_0%,#16181b_70%)] px-4 pt-5 pb-7 sm:px-6">
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.035)_45%,transparent_55%)]" />
        {groups.map((g) => <Shelf key={g} title={g} items={list.filter((t) => t.group === g)} selected={sel} onPick={(id) => setSel(sel === id ? null : id)} />)}
        {extra && extra.items.length > 0 && <Shelf title={extra.title} items={extra.items} selected={sel} onPick={(id) => setSel(sel === id ? null : id)} />}
      </div>
      {picked && (
        <div className="flex items-center gap-4 border-t border-white/[0.06] bg-[#1b1e22] px-5 py-3.5">
          <Cup tier={picked.tier} id={`${picked.id}-detail`} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#f1efe9]">{picked.title} <span className="font-normal text-[#a1a7ae]">· {TIER_NAME[picked.tier]}</span></p>
            <p className="tnum text-[13px] text-[#a1a7ae]">{picked.next === null ? `${picked.have} ${picked.unit}. Maxed out.` : `${picked.have} of ${picked.next} ${picked.unit} for ${TIER_NAME[(picked.tier + 1) as Tier].toLowerCase()}`}</p>
            {picked.next !== null && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#e9b93a]" style={{ width: `${Math.min(100, (picked.have / picked.next) * 100)}%` }} /></span>}
          </div>
          <div className="hidden gap-1 sm:flex">
            {picked.tiers.map((n, i) => <span key={i} className={cn('tnum rounded-md px-2 py-0.5 text-[12px]', picked.tier > i ? 'bg-white/10 text-[#f1efe9]' : 'text-[#6c727a]')}>{n}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
