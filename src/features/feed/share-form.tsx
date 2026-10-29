'use client';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import { toneFor } from '@/features/chat/live';
import { Icon } from '@/components/ui/icons';
import { useDrops } from '@/features/drop/live';
import { api, ApiError } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { FeedPost, PostVisibility } from '@/lib/types';
import { cn, plural } from '@/lib/utils';

export const VISIBILITY: { value: PostVisibility; label: string }[] = [
  { value: 'followers', label: 'Friends only' },
  { value: 'school', label: 'Friends and my school' },
  { value: 'everyone', label: 'Everyone' },
];

/** Who you are studying with right now: the people at your live drop. */
export function studyMates() {
  const x = useExtras.getState();
  const me = useProfile.getState().name;
  const now = Date.now();
  const mine = new Set([...x.myDrops.map((d) => d.id), ...x.joinedDrops.map((d) => d.dropId)]);
  const drop = useDrops.getState().drops.find((d) => mine.has(d.id) && d.startsAt <= now + 60_000 && d.endsAt > now - 2 * 3_600_000);
  if (!drop) return { place: '', with: [] as string[] };
  const names = [drop.name, ...drop.joiners.map((j) => j.name)].filter((n) => n && n !== me);
  return { place: drop.spotName, with: [...new Set(names)].slice(0, 10) };
}

/** Type, press Enter: small chips for names and topics. */
function ChipInput({ id, values, onChange, max, placeholder, more }: { id: string; values: string[]; onChange: (v: string[]) => void; max: number; placeholder: string; more: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const n = text.trim().replace(/,$/, '').slice(0, 50);
    if (n && !values.includes(n) && values.length < max) onChange([...values, n]);
    setText('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line-strong/60 bg-surface px-2 py-1.5 focus-within:border-accent">
      {values.map((n) => (
        <span key={n} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[13px] font-medium text-accent-ink">
          {n}
          <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(values.filter((x) => x !== n))}><Icon name="close" className="size-3" /></button>
        </span>
      ))}
      <input id={id} value={text} maxLength={50} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} placeholder={values.length ? more : placeholder} className="h-7 min-w-[140px] flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted" />
    </div>
  );
}

const TIMES = [30, 60, 120, 180, 300];

/** Shrinks a photo to at most 1080px on its long side as a JPEG. Re-encoding also drops location data. */
async function shrinkPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  for (const q of [0.75, 0.65, 0.55, 0.45]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length < 400_000) return url;
  }
  throw new Error('That photo is too large.');
}
const timeLabel = (m: number) => (m < 60 ? `${m}m` : `${m / 60}h`);

/** Post a study session. Just what and how long; friends, place and the rest are optional. */
export function ShareForm({ initial, onDone, submitLabel = 'Post' }: { initial?: { minutes?: number; subject?: string; topics?: string[]; place?: string; with?: string[]; note?: string; at?: number }; onDone: (post: FeedPost | null) => void; submitLabel?: string }) {
  const visibility = useExtras((s) => s.feedVisibility);
  const mates = studyMates();
  const [form, setForm] = useState({
    minutes: initial?.minutes ?? 60,
    subject: initial?.subject ?? '',
    topics: initial?.topics ?? ([] as string[]),
    place: initial?.place || mates.place,
    with: initial?.with ?? mates.with,
    note: initial?.note ?? '',
    visibility,
  });
  const [crew, setCrew] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhoto(await shrinkPhoto(f));
    } catch {
      toast('That photo could not be used. Try another.', 'error');
    }
  };
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  useEffect(() => {
    let live = true;
    api.people.week().then((r) => live && setFriends(r.friends.map(({ id, name }) => ({ id, name }))), () => undefined);
    return () => {
      live = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { post } = await api.feed.post({ ...form, minutes: Number(form.minutes), crewIds: crew, at: initial?.at, ...(photo ? { photo } : {}) });
      useExtras.getState().update({ feedVisibility: form.visibility });
      toast(crew.length ? `Posted for you and ${plural(crew.length, 'friend')}.` : 'Posted.');
      onDone(post);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not post. Try again.', 'error');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      {photo ? (
        <div className="relative overflow-hidden rounded-xl bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Your photo" className="max-h-72 w-full object-cover" />
          <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white"><Icon name="close" className="size-4" /></button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong/60 text-[13px] font-medium text-muted hover:border-accent hover:text-ink">
          <Icon name="camera" className="size-6" /> Add a photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      )}
      <Input aria-label="What you studied" autoFocus maxLength={60} placeholder="What did you study?" value={form.subject} onChange={(e) => set({ subject: e.target.value })} className="h-11 text-[16px]" />
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-muted">How long</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {TIMES.map((m) => <button key={m} type="button" aria-pressed={form.minutes === m} onClick={() => set({ minutes: m })} className={cn('h-9 min-w-12 rounded-lg border px-3 text-[14px] font-medium', form.minutes === m ? 'border-accent-fill bg-accent-fill text-white' : 'border-line hover:border-ink/30')}>{timeLabel(m)}</button>)}
          <Input aria-label="Minutes" type="number" min={5} max={720} value={form.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} className="h-9 w-20 text-[14px]" />
          <span className="text-[13px] text-muted">min</span>
        </div>
      </div>
      {friends.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-muted">Studied together with</p>
          <div className="flex flex-wrap gap-1.5">
            {friends.slice(0, 12).map((f) => {
              const on = crew.includes(f.id);
              return (
                <button key={f.id} type="button" aria-pressed={on} disabled={!on && crew.length >= 5} onClick={() => setCrew(on ? crew.filter((x) => x !== f.id) : [...crew, f.id])} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border pr-3 pl-1.5 text-[14px] disabled:opacity-40', on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:border-ink/30')}>
                  <Avatar name={f.name} color={toneFor(f.id)} size={22} />
                  {f.name.split(' ')[0]}
                  {on && <Icon name="check" className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {more ? (
        <div className="grid gap-3 border-t border-line pt-3">
          <Input aria-label="Where" maxLength={80} placeholder="Where" value={form.place} onChange={(e) => set({ place: e.target.value })} />
          <ChipInput id="shTopics" values={form.topics} onChange={(topics) => set({ topics })} max={8} placeholder="Topics covered" more="Add a topic" />
          {friends.length === 0 && <ChipInput id="shWith" values={form.with} onChange={(w) => set({ with: w })} max={10} placeholder="Studied with" more="Add someone" />}
          <Textarea aria-label="Caption" rows={2} maxLength={280} placeholder="Caption" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          <Select aria-label="Who can see it" value={form.visibility} onChange={(e) => set({ visibility: e.target.value as PostVisibility })}>{VISIBILITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</Select>
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="justify-self-start text-[13px] font-medium text-muted hover:text-ink">+ Place, topics, caption</button>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!form.minutes || form.minutes < 5}>{submitLabel}</Button>
        <Button variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
      </div>
    </form>
  );
}
