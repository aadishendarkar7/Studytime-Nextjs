'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldRow, Input, Select } from '@/components/ui/field';
import { Logo } from '@/components/ui/icons';
import { api, ApiError } from '@/lib/api';
import { MAJORS, YEARS } from '@/lib/constants';
import { useProfile } from '@/lib/stores/profile';
import { useAccount } from './account';

/** First sign-in: set up the profile classmates see. */
export function Welcome() {
  const user = useAccount((s) => s.user)!;
  const p = useProfile();
  const [form, setForm] = useState({
    name: p.name && p.name !== 'Student' ? p.name : user.name,
    school: p.school || user.profile.school,
    major: p.major || user.profile.major,
    year: p.year || user.profile.year,
    courses: (p.courses.length ? p.courses : user.profile.courses).join(', '),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (skip = false) => {
    setBusy(true);
    setError('');
    const courses = form.courses.split(/[,\n]/).map((c) => c.trim().toUpperCase().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 12);
    try {
      const body = skip ? { onboarded: true } : { name: form.name.trim() || user.name, school: form.school.trim(), major: form.major, year: form.year, courses, onboarded: true };
      const r = await api.auth.profile(body);
      if (!skip) p.update({ name: (form.name.trim() || user.name).slice(0, 30), school: form.school.trim().slice(0, 80), major: form.major, year: form.year, courses });
      useAccount.setState({ user: r.user });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-6 flex items-center gap-2 text-[17px] font-semibold tracking-tight"><Logo className="size-7" /> Studytime</div>
        <h1 className="font-sans text-[26px] leading-8 font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-1 text-[14px] text-muted">Your school and classes connect you with classmates on Drop a Spot, chat and the leaderboard.</p>
        <form className="mt-4" onSubmit={(e) => (e.preventDefault(), void save())}>
          <Field label="Name" htmlFor="wName"><Input id="wName" required maxLength={30} value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="School" htmlFor="wSchool"><Input id="wSchool" maxLength={80} placeholder="University of Maryland" value={form.school} onChange={(e) => set({ school: e.target.value })} /></Field>
          <FieldRow>
            <Field label="Major" htmlFor="wMajor">
              <Select id="wMajor" value={form.major} onChange={(e) => set({ major: e.target.value })}>
                <option value="">Choose</option>
                {MAJORS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Year" htmlFor="wYear">
              <Select id="wYear" value={form.year} onChange={(e) => set({ year: e.target.value })}>
                <option value="">Choose</option>
                {YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </Select>
            </Field>
          </FieldRow>
          <Field label="Your classes" hint="separate with commas" htmlFor="wCourses"><Input id="wCourses" placeholder="MATH240, STAT400" value={form.courses} onChange={(e) => set({ courses: e.target.value })} /></Field>
          {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">{error}</p>}
          <div className="mt-6 flex items-center gap-2">
            <Button type="submit" size="lg" loading={busy}>Start studying</Button>
            <Button variant="ghost" disabled={busy} onClick={() => void save(true)}>Skip for now</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
