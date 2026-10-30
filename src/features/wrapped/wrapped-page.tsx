'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { STYLES } from '@/features/profile/style';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { fmtMinutes } from '@/lib/utils';
import { hourLabel, PERIOD_LABEL, periodStart, wrap, type Period, type Wrapped } from './logic';

export const TAGLINE = 'If it’s not on Studytime, it didn’t happen.';

function Tile({ label, value, note, big }: { label: string; value: string; note?: string; big?: boolean }) {
  return (
    <div className={`min-w-0 panel p-5 ${big ? 'sm:col-span-2 lg:row-span-2' : ''}`}>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={`tnum mt-2 truncate font-semibold tracking-tight ${big ? 'text-[56px] leading-[60px]' : 'text-[26px] leading-8'}`}>{value}</p>
      {note && <p className="mt-1 text-[13px] text-muted">{note}</p>}
    </div>
  );
}

/** Draws the recap as a 1080 x 1350 image people can post. */
async function shareImage(w: Wrapped, period: Period, name: string, style: string) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#2f5bd3';
  g.fillStyle = '#09090b';
  g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = accent;
  g.fillRect(80, 120, 72, 8);
  const font = (size: number, weight = 600) => `${weight} ${size}px "Lexend Variable", system-ui, sans-serif`;
  g.fillStyle = '#a1a1aa';
  g.font = font(34, 500);
  g.fillText(`Studytime Wrapped · ${PERIOD_LABEL[period]}`, 80, 200);
  g.fillStyle = '#fafafa';
  g.font = font(64, 700);
  g.fillText(name || 'My study recap', 80, 280);
  const rows: [string, string][] = [
    ['Focus time', fmtMinutes(w.minutes)],
    ['Sessions', `${w.sessions} on ${w.days} ${w.days === 1 ? 'day' : 'days'}`],
    ['Top subject', w.subjects[0]?.name ?? '—'],
    ['Best day', w.weekday ?? '—'],
    ['Favorite spot', w.spot ?? '—'],
    ['Studied with', w.people ? `${w.people} ${w.people === 1 ? 'person' : 'people'}` : 'Solo'],
  ];
  if (style) rows.push(['Study style', style]);
  rows.forEach(([k, v], i) => {
    const y = 420 + i * 112;
    g.fillStyle = '#a1a1aa';
    g.font = font(30, 500);
    g.fillText(k, 80, y);
    g.fillStyle = '#fafafa';
    g.font = font(52, 700);
    const text = v.length > 26 ? `${v.slice(0, 25)}…` : v;
    g.fillText(text, 80, y + 58);
  });
  g.fillStyle = accent;
  g.font = font(34, 600);
  g.fillText(TAGLINE, 80, 1270);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) return toast('Could not make the image.', 'error');
  const file = new File([blob], 'studytime-wrapped.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Studytime Wrapped', text: TAGLINE });
      return;
    } catch {
      /* closed the share sheet */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'studytime-wrapped.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function WrappedPage() {
  const p = useProfile();
  const x = useExtras();
  const now = useNow(60_000);
  const [period, setPeriod] = useState<Period>('week');
  const w = useMemo(() => wrap({ sessions: p.sessions, dropLog: x.dropLog, water: x.water, checkins: x.checkins, from: periodStart(period, now), now }), [p.sessions, x.dropLog, x.water, x.checkins, period, now]);
  const style = p.studyStyle ? STYLES[p.studyStyle]?.name ?? '' : '';
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented wrap={false} label="Period" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((k) => ({ value: k, label: PERIOD_LABEL[k] }))} />
        <Button size="sm" className="ml-auto" disabled={!w.sessions} onClick={() => shareImage(w, period, p.name, style)}><Icon name="download" className="size-4" /> Share image</Button>
      </div>
      {w.sessions ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile big label="Focus time" value={fmtMinutes(w.minutes)} note={w.change === null ? `${w.sessions} sessions on ${w.days} ${w.days === 1 ? 'day' : 'days'}` : `${w.change >= 0 ? 'Up' : 'Down'} ${Math.abs(w.change)}% from the period before`} />
          <Tile label="Top subject" value={w.subjects[0]?.name ?? '—'} note={w.subjects.slice(1).map((s) => s.name).join(', ') || undefined} />
          <Tile label="Longest session" value={fmtMinutes(w.longest)} />
          <Tile label="Best day" value={w.weekday ?? '—'} note={w.hour !== null ? `Most focused around ${hourLabel(w.hour)}` : undefined} />
          <Tile label="Favorite spot" value={w.spot ?? 'None yet'} note={w.hosted || w.joined ? `${w.hosted} hosted, ${w.joined} joined` : undefined} />
          <Tile label="Studied with" value={w.people ? String(w.people) : 'Solo'} note={w.buddy ? `Most with ${w.buddy}` : undefined} />
          <Tile label="Water" value={`${w.glasses} glasses`} note={w.mood !== null ? `Average mood ${w.mood} of 5` : undefined} />
          {style && <Tile label="Study style" value={style} />}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-2 px-5 py-10 text-center">
          <p className="text-[15px] font-semibold">Nothing logged {PERIOD_LABEL[period].toLowerCase()} yet</p>
          <p className="mt-1 text-[13px] text-muted">Finish a focus session and your recap starts filling in.</p>
        </div>
      )}
      <p className="text-center text-[13px] text-muted">{TAGLINE}</p>
    </div>
  );
}
