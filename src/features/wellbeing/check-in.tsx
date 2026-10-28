'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { useExtras, type CheckIn, type Mood } from '@/lib/stores/extras';
import { toast } from '@/lib/stores/ui';
import { cn, todayKey } from '@/lib/utils';
import { MOODS } from './logic';
import { MOOD_FILL } from './mood';

const LEVELS = ['1', '2', '3', '4', '5'] as const;
const ENERGY = ['Drained', 'Low', 'Okay', 'Good', 'Charged'];
const STRESS = ['Calm', 'Mild', 'Some', 'High', 'Very high'];

export function MoodPicker({ value, onChange }: { value: Mood | null; onChange: (m: Mood) => void }) {
  return (
    <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-1.5">
      {MOODS.map((m) => (
        <button key={m.value} type="button" role="radio" aria-checked={value === m.value} onClick={() => onChange(m.value)} className={cn('flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[13px] font-medium transition-colors', value === m.value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-surface-3')}>
          <span className="size-5 rounded-full" style={{ background: MOOD_FILL[m.value] }} aria-hidden="true" />
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** A check-in in under 30 seconds. One per day; checking in again updates it. */
export function CheckInForm({ compact, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const { checkins, update } = useExtras();
  const today = todayKey();
  const existing = checkins.find((c) => c.day === today);
  type Draft = Omit<CheckIn, 'day' | 'mood'> & { mood: Mood | null };
  const [form, setForm] = useState<Draft>(() => existing ?? { mood: null, energy: 3, stress: 3, sleep: null, note: '' });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = () => {
    if (!form.mood) return toast('Pick how you feel first.', 'error');
    const entry: CheckIn = { day: today, mood: form.mood, energy: form.energy, stress: form.stress, sleep: form.sleep, note: form.note.trim().slice(0, 280) };
    update({ checkins: [entry, ...checkins.filter((c) => c.day !== today)].slice(0, 730) });
    toast(existing ? 'Check-in updated.' : 'Checked in. Thanks for taking a minute.');
    onSaved?.();
  };
  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold">How are you feeling today?</p>
      <MoodPicker value={form.mood} onChange={(mood) => set({ mood })} />
      <Field label="Energy">
        <Segmented label="Energy" value={String(form.energy) as (typeof LEVELS)[number]} onChange={(v) => set({ energy: Number(v) })} options={LEVELS.map((l, i) => ({ value: l, label: ENERGY[i] }))} />
      </Field>
      <Field label="Stress">
        <Segmented label="Stress" value={String(form.stress) as (typeof LEVELS)[number]} onChange={(v) => set({ stress: Number(v) })} options={LEVELS.map((l, i) => ({ value: l, label: STRESS[i] }))} />
      </Field>
      {!compact && (
        <>
          <Field label="Hours of sleep last night" hint="optional" htmlFor="ciSleep">
            <Input id="ciSleep" type="number" min={0} max={16} step={0.5} className="w-32" value={form.sleep ?? ''} onChange={(e) => set({ sleep: e.target.value === '' ? null : Math.min(16, Math.max(0, Number(e.target.value))) })} />
          </Field>
          <Field label="Anything on your mind?" hint="optional, only saved in this browser" htmlFor="ciNote">
            <Textarea id="ciNote" rows={2} maxLength={280} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
        </>
      )}
      <Button className="mt-4" onClick={save}>{existing ? 'Update check-in' : 'Check in'}</Button>
    </div>
  );
}
