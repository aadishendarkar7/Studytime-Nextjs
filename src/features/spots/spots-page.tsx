'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Note } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/segmented';
import { api } from '@/lib/api';
import { useExtras, type StudySpot } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { SPOT_TAGS, type PublicSpot } from '@/lib/types';
import { cn, uid } from '@/lib/utils';
import type { MapPin } from './spot-map';

const SpotMap = dynamic(() => import('./spot-map').then((m) => m.SpotMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center rounded-2xl bg-surface-3 text-[14px] text-muted">Loading map</div>,
});

type Show = 'all' | 'mine' | 'shared';

function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags">
      {SPOT_TAGS.map((t) => {
        const on = value.includes(t);
        return (
          <button key={t} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])} className={cn('rounded-lg border px-2.5 py-1 text-[13px] font-medium', on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-surface-3')}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function SpotsPage() {
  const router = useRouter();
  const { spots, update } = useExtras();
  const school = useProfile((s) => s.school);
  const setLocation = useProfile((s) => s.update);
  const [shared, setShared] = useState<PublicSpot[]>([]);
  const [show, setShow] = useState<Show>('all');
  const [tag, setTag] = useState('');
  // Start on the user's own spots if they have any.
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(() => {
    const first = useExtras.getState().spots[0];
    return first ? { lat: first.lat, lng: first.lng, zoom: 15 } : null;
  });
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState({ name: '', note: '', tags: [] as string[], share: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.spots.list().then((r) => setShared(r.spots), () => toast('Could not load shared spots. Your own spots still show.', 'error'));
  }, []);

  const mineShared = new Set(spots.map((s) => s.shared?.id).filter(Boolean));
  const pins = useMemo<MapPin[]>(() => {
    const match = (tags: string[]) => !tag || tags.includes(tag);
    const out: MapPin[] = [];
    if (show !== 'shared') for (const s of spots) if (match(s.tags)) out.push({ id: s.id, lat: s.lat, lng: s.lng, title: s.name, body: [s.tags.join(', '), s.note].filter(Boolean).join('. '), kind: 'mine' });
    if (show !== 'mine') for (const s of shared) if (!mineShared.has(s.id) && match(s.tags)) out.push({ id: s.id, lat: s.lat, lng: s.lng, title: s.name, body: [s.tags.join(', '), s.note, s.school].filter(Boolean).join('. '), kind: 'shared' });
    if (draft) out.push({ id: 'draft', ...draft, title: form.name || 'New spot', kind: 'draft' });
    return out;
    // mineShared is derived from spots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, shared, show, tag, draft, form.name]);

  const locate = () => {
    if (!navigator.geolocation) return toast('This browser cannot share your location.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setFocus({ ...at, zoom: 16 });
        setDraft(at);
      },
      () => toast('Location was blocked. Click the map to place the spot instead.', 'error'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = async () => {
    if (!draft) return toast('Click the map or use your location to place the spot.', 'error');
    if (!form.name.trim()) return toast('Name the spot.', 'error');
    const spot: StudySpot = { id: uid(), name: form.name.trim().slice(0, 60), lat: draft.lat, lng: draft.lng, note: form.note.trim().slice(0, 200), tags: form.tags, shared: null };
    setBusy(true);
    if (form.share) {
      try {
        spot.shared = await api.spots.share({ name: spot.name, lat: spot.lat, lng: spot.lng, note: spot.note, tags: spot.tags, school });
        setShared((list) => [...list, { id: spot.shared!.id, name: spot.name, lat: spot.lat, lng: spot.lng, note: spot.note, tags: spot.tags, school, createdAt: Date.now() }]);
      } catch (e) {
        toast(`Saved for you, but not shared: ${(e as Error).message}`, 'error');
      }
    }
    update({ spots: [...spots, spot] });
    setBusy(false);
    setDraft(null);
    setForm({ name: '', note: '', tags: [], share: false });
    toast(spot.shared ? 'Spot saved and shared on the public map.' : 'Spot saved.');
  };

  const remove = async (s: StudySpot) => {
    if (!confirm(`Remove ${s.name}?`)) return;
    if (s.shared) {
      try {
        await api.spots.remove(s.shared.id, s.shared.token);
        setShared((list) => list.filter((x) => x.id !== s.shared!.id));
      } catch (e) {
        return toast((e as Error).message, 'error');
      }
    }
    update({ spots: spots.filter((x) => x.id !== s.id) });
  };

  const studyHere = (s: StudySpot) => {
    setLocation({ location: s.name });
    router.push('/focus');
  };

  return (
    <>
      <PageHeader title="Study spots" description="Save the places you study best, and see spots other students have shared." />
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-3! lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 pb-3">
            <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'Mine' }, { value: 'shared', label: 'Shared' }]} />
            <Button variant="secondary" size="sm" onClick={locate}><Icon name="locate" className="size-4" /> Use my location</Button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-2 pb-3">
            <button type="button" aria-pressed={!tag} onClick={() => setTag('')} className={cn('rounded-lg px-2.5 py-1 text-[13px] font-medium', !tag ? 'bg-ink text-white' : 'bg-surface-3 hover:bg-line')}>Any</button>
            {SPOT_TAGS.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)} className={cn('rounded-lg px-2.5 py-1 text-[13px] font-medium', tag === t ? 'bg-ink text-white' : 'bg-surface-3 hover:bg-line')}>{t}</button>)}
          </div>
          <SpotMap pins={pins} focus={focus} onPick={(lat, lng) => setDraft({ lat, lng })} className="h-[520px] overflow-hidden rounded-xl max-sm:h-[380px]" />
          <p className="flex flex-wrap gap-4 px-2 pt-3 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-brand" /> Your spots</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-ink-2" /> Shared by students</span>
            <span>Click the map to place a new spot.</span>
          </p>
        </Card>

        <div className="grid content-start gap-5 lg:col-span-4">
          <Card>
            <CardHeader title="Add a spot" description={draft ? `Placed at ${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}.` : 'Click the map where it is, or use your location.'} />
            <Field label="Name" htmlFor="spotName" className="mt-0"><Input id="spotName" maxLength={60} placeholder="Third floor, Main Library" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tags"><TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} /></Field>
            <Field label="Note" hint="optional" htmlFor="spotNote"><Input id="spotNote" maxLength={200} placeholder="Window seats by the stairs" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <Checkbox label="Share on the public map" checked={form.share} onChange={(e) => setForm({ ...form, share: e.target.checked })} />
            <Note className="mt-0">Shared spots are visible to everyone. Share public places only, never a home address.</Note>
            <div className="mt-4 flex gap-2">
              <Button onClick={save} loading={busy}>Save spot</Button>
              {draft && <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Your spots" />
            {spots.length ? (
              <ul className="grid gap-2">
                {spots.map((s) => (
                  <li key={s.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" className="min-w-0 text-left" onClick={() => setFocus({ lat: s.lat, lng: s.lng, zoom: 17 })}>
                        <strong className="block truncate text-[15px] font-semibold hover:underline">{s.name}</strong>
                        {s.tags.length > 0 && <span className="text-[13px] text-muted">{s.tags.join(', ')}</span>}
                      </button>
                      {s.shared && <Badge tone="accent">Shared</Badge>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => studyHere(s)}>Study here</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s)}>Remove</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No saved spots yet. Saved spots also show up as location suggestions in the focus timer.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
