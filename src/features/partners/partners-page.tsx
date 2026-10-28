'use client';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CardHeader, Empty, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldRow, Input, Note, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Thinking } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { api, ApiError } from '@/lib/api';
import { YEARS } from '@/lib/constants';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import type { PartnerFormat, PartnerInput, PartnerListing } from '@/lib/types';
import { copyText, plural } from '@/lib/utils';

const FORMATS: { value: PartnerFormat; label: string }[] = [
  { value: 'in-person', label: 'In person' },
  { value: 'online', label: 'Online' },
  { value: 'either', label: 'Either' },
];
const formatLabel = (f: PartnerFormat) => FORMATS.find((x) => x.value === f)!.label;
const key = (c: string) => c.replace(/[\s-]+/g, '').toUpperCase();

function ago(ms: number) {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  return days < 1 ? 'Updated today' : `Updated ${plural(days, 'day')} ago`;
}

function ListingCard({ l, mine }: { l: PartnerListing; mine: string[] }) {
  const year = YEARS.find((y) => y.value === l.year)?.label;
  const shared = new Set(mine.map(key));
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[19px] leading-6">{l.name}</h3>
          <p className="text-[14px] text-muted">{[year, l.major, l.school].filter(Boolean).join(', ')}</p>
        </div>
        <Badge tone="accent">{formatLabel(l.format)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {l.courses.map((c) => <Badge key={c} tone={shared.has(key(c)) ? 'ok' : 'default'}>{c}</Badge>)}
      </div>
      {l.availability && <p className="mt-3 text-[14px]"><span className="text-muted">Free: </span>{l.availability}</p>}
      {l.note && <p className="mt-1 text-[14px] text-ink-2">{l.note}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="min-w-0 text-[14px]"><span className="text-muted">Contact: </span><span className="font-medium break-all">{l.contact}</span></span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted">{ago(l.updatedAt)}</span>
          <Button variant="secondary" size="sm" onClick={() => copyText(l.contact).then(() => toast('Contact copied.'))}><Icon name="copy" className="size-4" /> Copy</Button>
        </div>
      </div>
    </article>
  );
}

function Search() {
  const p = useProfile();
  const [course, setCourse] = useState(p.courses[0] ?? '');
  const [onlySchool, setOnlySchool] = useState(Boolean(p.school));
  const [format, setFormat] = useState<'' | PartnerFormat>('');
  const [results, setResults] = useState<PartnerListing[] | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async (c: string, school: boolean, f: string) => {
    setLoading(true);
    try {
      const { listings } = await api.partners.search({ course: c, school: school ? p.school : '', format: f });
      setResults(listings);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [p.school]);

  // Search once on open with the defaults; later searches run from the form.
  useEffect(() => {
    const p0 = useProfile.getState();
    api.partners
      .search({ course: p0.courses[0] ?? '', school: p0.school, format: '' })
      .then((r) => setResults(r.listings), (e) => toast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Find a partner" description="Students who listed themselves for the same course." />
      <form onSubmit={(e) => (e.preventDefault(), run(course, onlySchool, format))}>
        <div className="flex gap-2">
          <Input aria-label="Course" placeholder="Course code, like MATH240" value={course} maxLength={40} onChange={(e) => setCourse(e.target.value)} list="myCourses" />
          <datalist id="myCourses">{p.courses.map((c) => <option key={c} value={c} />)}</datalist>
          <Button type="submit" loading={loading}>Search</Button>
        </div>
        {p.courses.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.courses.map((c) => <button key={c} type="button" onClick={() => (setCourse(c), run(c, onlySchool, format))} className="rounded-md bg-surface-3 px-2 py-0.5 text-[13px] font-medium hover:bg-accent-soft hover:text-accent-ink">{c}</button>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Segmented label="Meeting format" value={format} onChange={(f) => (setFormat(f), run(course, onlySchool, f))} options={[{ value: '', label: 'Any' }, { value: 'in-person', label: 'In person' }, { value: 'online', label: 'Online' }]} />
          {p.school ? (
            <Checkbox label={`Only ${p.school}`} checked={onlySchool} onChange={(e) => (setOnlySchool(e.target.checked), run(course, e.target.checked, format))} />
          ) : (
            <span className="text-[14px] text-muted">Add your school on your profile to filter by it.</span>
          )}
        </div>
      </form>
      <div className="mt-5 grid gap-3">
        {loading && !results ? <Thinking label="Searching" /> : results && results.length ? (
          <>
            <p className="text-[14px] text-muted">{plural(results.length, 'student')} found</p>
            {results.map((l) => <ListingCard key={l.id} l={l} mine={p.courses} />)}
          </>
        ) : results ? (
          <Empty title="No one listed yet">
            {course ? `Nobody has listed ${course}${onlySchool && p.school ? ` at ${p.school}` : ''} yet.` : 'No listings match.'} Add your own listing so the next student who searches finds you.
          </Empty>
        ) : null}
      </div>
    </Card>
  );
}

function MyListing() {
  const p = useProfile();
  const { partnerListing, update } = useExtras();
  const blank = (): PartnerInput => ({ name: p.name, school: p.school, major: p.major, year: p.year, courses: p.courses.slice(0, 8), format: 'either', availability: '', contact: '', note: '' });
  const [form, setForm] = useState<PartnerInput>(blank);
  const [coursesText, setCoursesText] = useState(form.courses.join(', '));
  const [daysLeft, setDaysLeft] = useState(30);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(Boolean(partnerListing));
  const set = (patch: Partial<PartnerInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!partnerListing) return;
    api.partners.mine(partnerListing.id, partnerListing.token).then(
      (l) => { setForm(l); setCoursesText(l.courses.join(', ')); setDaysLeft(Math.max(0, 30 - Math.floor((Date.now() - l.updatedAt) / 86_400_000))); },
      (e) => { if (e instanceof ApiError && e.status === 404) update({ partnerListing: null }); },
    );
  }, [partnerListing, update]);

  const save = async () => {
    const body = { ...form, courses: coursesText.split(',').map((c) => c.trim()).filter(Boolean) };
    if (!body.courses.length) return toast('Add at least one course.', 'error');
    if (!body.contact.trim()) return toast('Add how partners can reach you.', 'error');
    if (!agree) return toast('Confirm that your listing is public.', 'error');
    setBusy(true);
    try {
      if (partnerListing) await api.partners.update(partnerListing.id, partnerListing.token, body);
      else update({ partnerListing: await api.partners.create(body) });
      setDaysLeft(30);
      toast(partnerListing ? 'Listing updated.' : 'You are listed. Other students can find you now.');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!partnerListing || !confirm('Remove your listing?')) return;
    try {
      await api.partners.remove(partnerListing.id, partnerListing.token);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) return toast((e as Error).message, 'error');
    }
    update({ partnerListing: null });
    toast('Listing removed.');
  };

  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Your listing" description={partnerListing ? `Listed. It is removed in ${plural(daysLeft, 'day')} unless you update it.` : 'List yourself so classmates looking for a partner can find you.'} />
      <FieldRow className="mt-0">
        <Field label="Name" htmlFor="plName"><Input id="plName" maxLength={30} value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="School" htmlFor="plSchool"><Input id="plSchool" maxLength={80} value={form.school} onChange={(e) => set({ school: e.target.value })} /></Field>
      </FieldRow>
      <Field label="Courses" hint="separate with commas" htmlFor="plCourses"><Input id="plCourses" value={coursesText} maxLength={300} placeholder="MATH240, STAT400" onChange={(e) => setCoursesText(e.target.value)} /></Field>
      <Field label="Meet"><Segmented label="Meeting format" value={form.format} onChange={(f) => set({ format: f })} options={FORMATS} /></Field>
      <Field label="When you are free" htmlFor="plAvail"><Input id="plAvail" maxLength={120} placeholder="Weeknights after 7, Sunday afternoons" value={form.availability} onChange={(e) => set({ availability: e.target.value })} /></Field>
      <Field label="How to reach you" htmlFor="plContact"><Input id="plContact" maxLength={120} placeholder="School email, Discord or Instagram handle" value={form.contact} onChange={(e) => set({ contact: e.target.value })} /></Field>
      <Field label="Note" hint="optional" htmlFor="plNote"><Textarea id="plNote" rows={3} maxLength={280} placeholder="What you want to work on, like problem sets before each quiz" value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
      <Checkbox label="I understand anyone using Studytime can see this listing, including my contact." checked={agree} onChange={(e) => setAgree(e.target.checked)} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} loading={busy}>{partnerListing ? 'Update listing' : 'Publish listing'}</Button>
        {partnerListing && <Button variant="danger" onClick={remove}>Remove</Button>}
      </div>
      <Note>Share a school email or a social handle, not your phone number or home address. Meet new partners in a public place like the library.</Note>
    </Card>
  );
}

export function PartnersPage({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <>
      {!embedded && <PageHeader title="Study partners" description="Find classmates taking the same course and set up a time to study together." />}
      <div className="grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <Search />
        <MyListing />
      </div>
    </>
  );
}
