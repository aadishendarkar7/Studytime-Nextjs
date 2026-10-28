'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras, type DropLogEntry } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { CATEGORIES } from '@/lib/types';
import { uid } from '@/lib/utils';
import { refreshDrops } from './live';
import { recentPlaces, VIBES } from './logic';

export type DropPreset = { lat: number; lng: number } | { minutes: number } | { again: DropLogEntry } | { solo: true } | { subject: string; spotName?: string } | null;

type Audience = 'circle' | 'school' | 'everyone' | 'solo';

const AUDIENCE: { value: Audience; label: string; note: string }[] = [
  { value: 'circle', label: 'Friends', note: 'Your friend circle gets a notification.' },
  { value: 'school', label: 'My school', note: 'Students at your school can see it and join.' },
  { value: 'everyone', label: 'Everyone', note: 'Anyone on Studytime can see it.' },
  { value: 'solo', label: 'Just me', note: 'Nobody is notified. Good for heads-down days.' },
];

/** The composer: where, what, when, and who gets told. */
export function DropComposer({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: DropPreset }) {
  const p = useProfile();
  const x = useExtras();
  const router = useRouter();
  const again = preset && 'again' in preset ? preset.again : null;
  const [form, setForm] = useState(() => ({
    spotName: again?.spotName ?? (preset && 'spotName' in preset && preset.spotName ? preset.spotName : preset && 'lat' in preset ? '' : p.location || ''),
    lat: again ? again.lat : preset && 'lat' in preset ? preset.lat : (null as number | null),
    lng: again ? again.lng : preset && 'lng' in preset ? preset.lng : (null as number | null),
    subject: again?.subject || (preset && 'subject' in preset ? preset.subject : '') || p.subject || p.courses[0] || '',
    vibe: again?.vibe ?? x.dropVibe,
    seats: null as number | null,
    category: 'Anything goes',
    note: '',
    when: 'now' as 'now' | 'later',
    minutes: preset && 'minutes' in preset ? Math.max(60, preset.minutes) : 120,
    laterAt: '',
    audience: (preset && 'solo' in preset ? 'solo' : x.dropAudience === 'circle' && !p.circle ? 'school' : x.dropAudience) as Audience,
    startTimer: true,
    saveSpot: false,
  }));
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const locate = () => {
    if (!navigator.geolocation) return toast('This browser cannot share your location.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => (set({ lat: pos.coords.latitude, lng: pos.coords.longitude }), toast('Location added.')),
      () => toast('Location was blocked. Type the place name instead.', 'error'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async () => {
    if (!form.spotName.trim()) return toast('Say where you are studying.', 'error');
    const startsAt = form.when === 'now' ? Date.now() : new Date(form.laterAt).getTime();
    if (!Number.isFinite(startsAt)) return toast('Pick a start time.', 'error');
    const endsAt = startsAt + form.minutes * 60_000;
    x.update({ dropAudience: form.audience, dropVibe: form.vibe });
    const logEntry = (id: string, role: 'host' | 'solo') => ({ id, spotName: form.spotName.trim().slice(0, 80), subject: form.subject.trim(), vibe: form.vibe, lat: form.lat, lng: form.lng, at: startsAt, minutes: form.minutes, role, with: [] as string[] });
    if (form.saveSpot && form.lat !== null && form.lng !== null && !x.spots.some((s) => s.name === form.spotName.trim())) {
      x.update({ spots: [...x.spots, { id: uid(), name: form.spotName.trim().slice(0, 60), lat: form.lat, lng: form.lng, note: '', tags: [], shared: null }] });
    }
    const startNow = form.when === 'now' && form.startTimer;
    const goStudy = () => {
      p.update({ location: form.spotName.trim().slice(0, 80), subject: form.subject.slice(0, 60) });
      if (startNow && p.timer.mode === 'ready') {
        p.setDuration(Math.min(240, form.minutes));
        p.startOrPause();
        router.push('/focus');
      }
    };
    if (form.audience === 'solo') {
      x.update({ dropLog: [...useExtras.getState().dropLog, logEntry(uid(), 'solo')].slice(-200) });
      goStudy();
      toast('Solo session. Nobody was notified.');
      return onClose();
    }
    setBusy(true);
    try {
      const r = await api.drops.create({ name: p.name, spotName: form.spotName, lat: form.lat, lng: form.lng, subject: form.subject, note: form.note, startsAt, endsAt, audience: form.audience, vibe: form.vibe, seats: form.seats, category: form.category, school: p.school, circle: p.circle ? { code: p.circle.code, memberId: p.circle.memberId } : null });
      const st = useExtras.getState();
      x.update({ myDrops: [...st.myDrops, { id: r.id, token: r.token, endsAt }], dropLog: [...st.dropLog, logEntry(r.id, 'host')].slice(-200) });
      useProfile.getState().update({ points: useProfile.getState().points + 10 });
      await refreshDrops(false);
      toast(form.audience === 'circle' ? 'Dropped. Your friends were notified.' : form.audience === 'school' ? 'Dropped. Students at your school can see it.' : 'Dropped. Anyone can see it.');
      goStudy();
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const audienceNote = AUDIENCE.find((a) => a.value === form.audience)!.note;
  const recent = recentPlaces(x.dropLog, 4).filter((e) => e.spotName !== form.spotName);
  return (
    <Dialog open={open} onClose={onClose} title={form.audience === 'solo' ? 'Study solo' : 'Drop a spot'}>
      {recent.length > 0 && (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-muted">Again at</span>
          {recent.map((e) => (
            <button key={e.id} type="button" onClick={() => set({ spotName: e.spotName, lat: e.lat, lng: e.lng, subject: e.subject || form.subject, vibe: e.vibe })} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink">{e.spotName}</button>
          ))}
        </div>
      )}
      <Field label="Where are you studying?" htmlFor="dpWhere" className="mt-0">
        <div className="flex gap-2">
          <Input id="dpWhere" maxLength={80} list="dpSpots" placeholder="McKeldin Library, 3rd floor" value={form.spotName} onChange={(e) => { const v = e.target.value; const saved = x.spots.find((s) => s.name === v); set(saved ? { spotName: v, lat: saved.lat, lng: saved.lng } : { spotName: v }); }} />
          <Button variant="secondary" onClick={locate} aria-label="Use my location"><Icon name="locate" className="size-4" /></Button>
        </div>
        <datalist id="dpSpots">{x.spots.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        <p className="mt-1 text-[13px] text-muted">{form.lat !== null ? 'On the map at your location.' : 'Add your location to show it on the map.'}</p>
      </Field>
      <Field label="Studying" hint="optional" htmlFor="dpWhat"><Input id="dpWhat" maxLength={60} list="dpCourses" placeholder="STAT400 problem set" value={form.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
      <datalist id="dpCourses">{p.courses.map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Category" htmlFor="dpCat">
        <Select id="dpCat" value={form.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
      </Field>
      <Field label="Table vibe">
        <Segmented className="[&>button]:flex-1" label="Table vibe" value={form.vibe} onChange={(vibe) => set({ vibe })} options={VIBES.map((v) => ({ value: v.value, label: v.label }))} />
        <p className="mt-1.5 text-[13px] text-muted">{VIBES.find((v) => v.value === form.vibe)!.note}</p>
      </Field>
      <FieldRow>
        <Field label="When">
          <Segmented className="[&>button]:flex-1" wrap={false} label="When" value={form.when} onChange={(when) => set({ when })} options={[{ value: 'now', label: 'Now' }, { value: 'later', label: 'Later' }]} />
        </Field>
        <Field label="For" htmlFor="dpFor">
          <Select id="dpFor" value={form.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })}>{[30, 60, 90, 120, 180, 240, 360].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? 'hour' : 'hours'}`}</option>)}</Select>
        </Field>
      </FieldRow>
      {form.audience !== 'solo' && (
        <Field label="Open seats" htmlFor="dpSeats">
          <Select id="dpSeats" value={form.seats ?? ''} onChange={(e) => set({ seats: e.target.value ? Number(e.target.value) : null })}>
            <option value="">No limit</option>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'seat' : 'seats'}</option>)}
          </Select>
        </Field>
      )}
      {form.when === 'later' && <Field label="Starting" htmlFor="dpLater"><Input id="dpLater" type="datetime-local" value={form.laterAt} onChange={(e) => set({ laterAt: e.target.value })} /></Field>}
      <Field label="Who can see it">
        <Segmented className="[&>button]:flex-1" label="Who can see it" value={form.audience} onChange={(audience) => set({ audience })} options={AUDIENCE.map((a) => ({ value: a.value, label: a.label }))} />
        <p className="mt-1.5 text-[13px] text-muted">{form.audience === 'circle' && !p.circle ? <>You have no friend circle yet. <Link href="/drop?tab=friends&view=circle" className="underline" onClick={onClose}>Create one</Link>.</> : form.audience === 'school' && !p.school ? <>Add your school on <Link href="/you?tab=profile" className="underline" onClick={onClose}>your profile</Link> first.</> : audienceNote}</p>
      </Field>
      <Field label="Note" hint="optional" htmlFor="dpNote"><Input id="dpNote" maxLength={200} placeholder="Window table, bring snacks" value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      {form.when === 'now' && <Checkbox label="Start my focus timer now" checked={form.startTimer} onChange={(e) => set({ startTimer: e.target.checked })} />}
      {form.lat !== null && !x.spots.some((s) => s.name === form.spotName.trim()) && <Checkbox label="Save this place to my spots" checked={form.saveSpot} onChange={(e) => set({ saveSpot: e.target.checked })} />}
      <div className="mt-5 flex gap-2">
        <Button onClick={submit} loading={busy}><Icon name="pin" className="size-4" /> {form.audience === 'solo' ? 'Start solo' : 'Drop it'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
      <Note>Drops are for public places. Never drop a home address.</Note>
    </Dialog>
  );
}


/** One composer for the whole app, so any page can open it. */
export const useDropComposer = create<{ open: boolean; key: number; preset: DropPreset; show: (preset?: DropPreset) => void; hide: () => void }>()((set) => ({
  open: false,
  key: 0,
  preset: null,
  show: (preset = null) => set((s) => ({ open: true, key: s.key + 1, preset })),
  hide: () => set({ open: false }),
}));

export function DropComposerHost() {
  const { open, key, preset, hide } = useDropComposer();
  return open ? <DropComposer key={key} open onClose={hide} preset={preset} /> : null;
}
