'use client';
import { useState } from 'react';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldRow, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras, type GpaCourse, type GpaTerm } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, uid } from '@/lib/utils';
import { cumulativeGpa, GPA_GRADES, neededForTarget, termGpa } from './logic';

const gpa = (n: number | null) => (n === null ? 'None' : n.toFixed(2));

/** "Fall 2026" style name for the term containing today. */
function currentTermName(d = new Date()) {
  const m = d.getMonth();
  return `${m <= 4 ? 'Spring' : m <= 7 ? 'Summer' : 'Fall'} ${d.getFullYear()}`;
}

function NumberField({ id, label, hint, value, onChange, step = 1, max }: { id: string; label: string; hint?: string; value: number | null; onChange: (n: number | null) => void; step?: number; max?: number }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} type="number" min={0} max={max} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className="tnum" />
    </Field>
  );
}

function TermCard({ term, plus }: { term: GpaTerm; plus: boolean }) {
  const { gpaTerms, update, setTerm } = useExtras();
  const r = termGpa(term, plus);
  const setCourse = (id: string, patch: Partial<GpaCourse>) => setTerm(term.id, (t) => ({ ...t, courses: t.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input aria-label="Term name" value={term.name} maxLength={30} onChange={(e) => setTerm(term.id, (t) => ({ ...t, name: e.target.value }))} className="h-10 max-w-56 font-display text-[19px]" />
        <span className="tnum text-[14px] text-muted">Term GPA <strong className="ml-1 text-[20px] font-semibold text-ink">{gpa(r.gpa)}</strong> <span className="ml-2">{r.credits} credits</span></span>
      </div>
      {term.courses.length > 0 && (
        <div className="mb-2 grid grid-cols-[1fr_76px_92px_40px] gap-2 text-[13px] font-semibold text-muted">
          <span>Course</span><span>Credits</span><span>Grade</span><span className="sr-only">Remove</span>
        </div>
      )}
      <div className="grid gap-2">
        {term.courses.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_76px_92px_40px] items-center gap-2">
            <Input aria-label="Course name" value={c.name} maxLength={60} onChange={(e) => setCourse(c.id, { name: e.target.value })} className="h-10" />
            <Input aria-label={`${c.name} credits`} type="number" min={0} max={12} step={0.5} value={c.credits} onChange={(e) => setCourse(c.id, { credits: Math.max(0, Number(e.target.value) || 0) })} className="tnum h-10" />
            <Select aria-label={`${c.name} grade`} value={c.grade} onChange={(e) => setCourse(c.id, { grade: e.target.value })} className="h-10">
              <option value="">Grade</option>
              {GPA_GRADES.map((g) => <option key={g}>{g}</option>)}
            </Select>
            <button type="button" aria-label={`Remove ${c.name}`} onClick={() => setTerm(term.id, (t) => ({ ...t, courses: t.courses.filter((x) => x.id !== c.id) }))} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger">
              <Icon name="trash" className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setTerm(term.id, (t) => ({ ...t, courses: [...t.courses, { id: uid(), name: `Course ${t.courses.length + 1}`, credits: 3, grade: '' }] }))}><Icon name="plus" className="size-4" /> Add course</Button>
        <Button variant="ghost" size="sm" onClick={() => confirm(`Delete ${term.name}?`) && update({ gpaTerms: gpaTerms.filter((t) => t.id !== term.id) })}>Delete term</Button>
      </div>
    </Card>
  );
}

export function GpaCalculator() {
  const x = useExtras();
  const courses = useProfile((s) => s.courses);
  const [futureCredits, setFutureCredits] = useState<number | null>(15);
  const total = cumulativeGpa(x.gpaTerms, { gpa: x.priorGpa, credits: x.priorCredits }, x.plusCountsHigher);
  const needed = x.targetGpa !== null && futureCredits ? neededForTarget(total, x.targetGpa, futureCredits) : null;

  const addTerm = (withCourses: boolean) => {
    const term: GpaTerm = {
      id: uid(),
      name: x.gpaTerms.length ? `Term ${x.gpaTerms.length + 1}` : currentTermName(),
      courses: withCourses && courses.length ? courses.map((name) => ({ id: uid(), name, credits: 3, grade: '' })) : [{ id: uid(), name: 'Course 1', credits: 3, grade: '' }],
    };
    x.update({ gpaTerms: [...x.gpaTerms, term] });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="grid content-start gap-5 lg:col-span-7">
        <Card>
          <CardHeader title="Before these terms" description="Optional. Copy your cumulative GPA and credits from your transcript to include earlier terms." />
          <FieldRow className="mt-0">
            <NumberField id="priorGpa" label="Cumulative GPA" value={x.priorGpa} step={0.01} max={4.3} onChange={(n) => x.update({ priorGpa: n })} />
            <NumberField id="priorCredits" label="Credits counted" hint="GPA credits" value={x.priorCredits || null} onChange={(n) => x.update({ priorCredits: n ?? 0 })} />
          </FieldRow>
        </Card>
        {x.gpaTerms.map((t) => <TermCard key={t.id} term={t} plus={x.plusCountsHigher} />)}
        {!x.gpaTerms.length && <Empty>Add a term and enter each course&rsquo;s credits and letter grade. Grades you expect work too, for planning.</Empty>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => addTerm(false)}><Icon name="plus" className="size-4" /> Add term</Button>
          {courses.length > 0 && <Button variant="secondary" onClick={() => addTerm(true)}>Add term with my {courses.length} courses</Button>}
        </div>
      </div>

      <div className="grid content-start gap-5 lg:col-span-5">
        <Card>
          <CardHeader title="Cumulative GPA" />
          <p className="tnum font-display text-[56px] leading-[60px]">{gpa(total.gpa)}</p>
          <p className="tnum mt-1 text-[14px] text-muted">{total.credits} credits counted</p>
          <Checkbox label="A+ counts as 4.3" checked={x.plusCountsHigher} onChange={(e) => x.update({ plusCountsHigher: e.target.checked })} />
          <Note className="mt-0">Leave this off if your school caps A+ at 4.0. P and W grades are left out of GPA.</Note>
        </Card>
        <Card>
          <CardHeader title="Reach a target GPA" />
          <FieldRow className="mt-0">
            <NumberField id="targetGpa" label="Target GPA" value={x.targetGpa} step={0.01} max={4.3} onChange={(n) => x.update({ targetGpa: n })} />
            <NumberField id="futureCredits" label="Credits left" hint="to take" value={futureCredits} onChange={setFutureCredits} />
          </FieldRow>
          {needed !== null && (
            <p className={cn('mt-4 text-[16px] leading-6', needed > 4 && 'text-warn')}>
              {needed > (x.plusCountsHigher ? 4.3 : 4)
                ? `Not reachable in ${futureCredits} credits. You would need ${needed.toFixed(2)}.`
                : needed <= 0
                  ? 'You stay above that target whatever grades you get.'
                  : <>You need an average of <strong className="tnum font-semibold">{needed.toFixed(2)}</strong> over the next {futureCredits} credits.</>}
            </p>
          )}
        </Card>
        <Note>This is an estimate. Your school&rsquo;s transcript is the official GPA, and repeated courses or transfer credit can change it.</Note>
      </div>
    </div>
  );
}
