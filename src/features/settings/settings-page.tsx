'use client';
import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { exportBackup, importBackup } from '@/lib/stores/hydrate';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn, downloadFile } from '@/lib/utils';
import { AiSettings } from './ai-settings';

export const MAJORS = ['Biology', 'Business', 'Computer Science', 'Engineering', 'Psychology', 'Arts & Humanities', 'Other'];
const SWATCHES = [['#7eab58', 'Sage green'], ['#558cb7', 'Ocean blue'], ['#9a77bd', 'Soft purple'], ['#ca8460', 'Warm coral'], ['#c79b48', 'Golden amber']];

function ProfileCard() {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [daily, setDaily] = useState(p.dailyGoal);
  const [weekly, setWeekly] = useState(p.weeklyGoal);
  return (
    <Card>
      <CardHeader eyebrow="YOUR SPACE" title="Profile & goals" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || daily < 15 || daily > 720 || weekly < 30 || weekly > 5040) return toast('Check your name and goals.', 'error');
          p.update({ name: name.trim().slice(0, 30), dailyGoal: daily, weeklyGoal: weekly });
          toast('Profile and goals saved.');
        }}
      >
        <Field label="Your name" htmlFor="name"><Input id="name" maxLength={30} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <FieldRow>
          <Field label="Daily goal" hint="minutes" htmlFor="dailyGoal"><Input id="dailyGoal" type="number" min={15} max={720} step={5} value={daily} onChange={(e) => setDaily(Number(e.target.value))} /></Field>
          <Field label="Weekly goal" hint="minutes" htmlFor="weeklyGoal"><Input id="weeklyGoal" type="number" min={30} max={5040} step={5} value={weekly} onChange={(e) => setWeekly(Number(e.target.value))} /></Field>
        </FieldRow>
        <Button type="submit" className="mt-5">Save changes</Button>
      </form>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, accent, update } = useProfile();
  return (
    <Card>
      <CardHeader eyebrow="APPEARANCE" title="Theme & color" />
      <div className="grid grid-cols-2 gap-2.5">
        {(['light', 'dark'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={theme === t} onClick={() => update({ theme: t })} className={cn('flex items-center gap-3 rounded-xl border p-4 text-left', theme === t ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-2')}>
            <Icon name={t === 'light' ? 'sun' : 'moon'} />
            <span><strong className="block text-sm capitalize">{t} mode</strong><small className="text-xs text-muted">{t === 'light' ? 'Bright and airy' : 'Easy on the eyes'}</small></span>
          </button>
        ))}
      </div>
      <Field label="Accent color" className="mt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          {SWATCHES.map(([c, label]) => (
            <button key={c} type="button" aria-label={label} aria-pressed={accent.toLowerCase() === c} onClick={() => update({ accent: c })} className={cn('size-9 rounded-full border-4 border-surface ring-2', accent.toLowerCase() === c ? 'ring-ink' : 'ring-transparent')} style={{ background: c }} />
          ))}
          <label className="ml-2 flex items-center gap-2 text-xs text-muted">
            <input type="color" value={accent} onChange={(e) => update({ accent: e.target.value })} className="size-9 cursor-pointer rounded-lg border border-line bg-transparent" aria-label="Custom color" />
            {accent}
          </label>
        </div>
      </Field>
    </Card>
  );
}

function MajorCard() {
  const { major, courses, update, addCourse, removeCourse } = useProfile();
  const [course, setCourse] = useState('');
  return (
    <Card>
      <CardHeader eyebrow="YOUR MAJOR" title="Study your way" />
      <Field label="Major" htmlFor="majorSelect">
        <Select id="majorSelect" value={major} onChange={(e) => update({ major: e.target.value })}>
          <option value="">Choose your major</option>
          {MAJORS.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Your courses" htmlFor="courseInput">
        <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), addCourse(course), setCourse(''))}>
          <Input id="courseInput" maxLength={60} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Add a course or subject" />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
      </Field>
      <div className="mt-3 flex flex-wrap gap-2">
        {courses.length ? courses.map((c, i) => (
          <span key={c} className="flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1.5 pl-3 text-[13px] font-semibold text-accent-ink">
            {c}<button type="button" onClick={() => removeCourse(i)} aria-label={`Remove ${c}`} className="rounded-full p-0.5 hover:bg-white/50"><Icon name="close" className="size-3.5" /></button>
          </span>
        )) : <Note className="mt-0">Courses appear as suggestions in the focus timer and syllabus import.</Note>}
      </div>
    </Card>
  );
}

function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader eyebrow="YOUR DATA" title="Backup & restore" description="Your progress is saved in this browser. Export a backup to move it to another device." />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadFile(`studytime-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), 'application/json')}><Icon name="download" className="size-4" /> Export backup</Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Icon name="upload" className="size-4" /> Import backup</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !confirm('Replace the progress in this browser with this backup?')) return;
            try {
              await importBackup(await f.text());
              toast('Backup restored.');
            } catch (error) {
              toast((error as Error).message, 'error');
            }
          }}
        />
      </div>
      <Note>Backups never include your API keys.</Note>
    </Card>
  );
}

export function SettingsPage() {
  useEffect(() => {
    if (location.hash === '#ai') setTimeout(() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  return (
    <>
      <PageHeader eyebrow="MAKE IT FEEL LIKE YOURS" title="Settings" description="Connect the AI tutor, set your goals, and choose a comfortable look." />
      <div className="grid gap-5 lg:grid-cols-2">
        <AiSettings />
        <ProfileCard />
        <AppearanceCard />
        <MajorCard />
        <DataCard />
      </div>
    </>
  );
}
