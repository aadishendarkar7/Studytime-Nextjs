'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useDrops } from '@/features/drop/live';
import { api, ApiError } from '@/lib/api';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { FeedPost, PostVisibility } from '@/lib/types';

export const VISIBILITY: { value: PostVisibility; label: string }[] = [
  { value: 'followers', label: 'People who follow me' },
  { value: 'school', label: 'My school and followers' },
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

/** Save a study session as a highlight: what, where, who with, and the topics covered. */
export function ShareForm({ initial, onDone, submitLabel = 'Save highlight' }: { initial?: { minutes?: number; subject?: string; topics?: string[]; place?: string; with?: string[]; note?: string; at?: number }; onDone: (post: FeedPost | null) => void; submitLabel?: string }) {
  const visibility = useExtras((s) => s.feedVisibility);
  const mates = studyMates();
  const [form, setForm] = useState({
    minutes: initial?.minutes ?? 50,
    subject: initial?.subject ?? '',
    topics: initial?.topics ?? ([] as string[]),
    place: initial?.place || mates.place,
    with: initial?.with ?? mates.with,
    note: initial?.note ?? '',
    visibility,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { post } = await api.feed.post({ ...form, minutes: Number(form.minutes), at: initial?.at });
      useExtras.getState().update({ feedVisibility: form.visibility });
      toast('Saved to your highlights.');
      onDone(post);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save. Try again.', 'error');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <FieldRow className="mt-0">
        <Field label="What you studied" htmlFor="shSubject"><Input id="shSubject" maxLength={60} placeholder="STAT400 problem set" value={form.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
        <Field label="Minutes" htmlFor="shMin"><Input id="shMin" type="number" min={5} max={720} required value={form.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} /></Field>
      </FieldRow>
      <Field label="Where" htmlFor="shPlace"><Input id="shPlace" maxLength={80} placeholder="McKeldin Library, 3rd floor" value={form.place} onChange={(e) => set({ place: e.target.value })} /></Field>
      <Field label="Topics you covered" hint="press Enter after each" htmlFor="shTopics"><ChipInput id="shTopics" values={form.topics} onChange={(topics) => set({ topics })} max={8} placeholder="Hypothesis tests, p-values" more="Add a topic" /></Field>
      <Field label="Studied with" hint="optional" htmlFor="shWith"><ChipInput id="shWith" values={form.with} onChange={(w) => set({ with: w })} max={10} placeholder="Type a name and press Enter" more="Add someone" /></Field>
      <Field label="One line about it" hint="optional" htmlFor="shNote"><Textarea id="shNote" rows={2} maxLength={280} placeholder="Finally understood the central limit theorem." value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <Field label="Who can see it" htmlFor="shVis"><Select id="shVis" value={form.visibility} onChange={(e) => set({ visibility: e.target.value as PostVisibility })}>{VISIBILITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</Select></Field>
      <div className="mt-5 flex gap-2">
        <Button type="submit" loading={busy}>{submitLabel}</Button>
        <Button variant="ghost" onClick={() => onDone(null)}>Not now</Button>
      </div>
    </form>
  );
}
