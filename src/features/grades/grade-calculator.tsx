'use client';
import { useState } from 'react';
import { Badge, Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { newGradeCourse, useExtras, type GradeCategory, type GradeCourse } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { cn, uid } from '@/lib/utils';
import { LETTER_CUTOFFS, letterFor, outlook, parseScore } from './logic';

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
/** Rounds down, so a best case of 89.95 never reads as 90. */
const fmtDown = (n: number) => (Math.floor(n * 10 + 1e-9) / 10).toString();

/** Accepts "88", "88%" or "44/50"; saves on blur so typing a fraction is not interrupted. */
function ScoreInput({ category, onCommit }: { category: GradeCategory; onCommit: (score: number | null) => void }) {
  const [text, setText] = useState(category.score === null ? '' : fmt(category.score));
  const parsed = parseScore(text);
  const invalid = text.trim() !== '' && parsed === null;
  return (
    <div>
      <Input
        aria-label={`${category.name} score`}
        inputMode="decimal"
        placeholder="Not graded"
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          onCommit(parsed);
          if (parsed !== null && text.includes('/')) setText(fmt(parsed));
        }}
        className={cn('h-10', invalid && 'border-danger')}
      />
      {invalid && <p className="mt-1 text-[13px] text-danger">Type a percent or points like 44/50.</p>}
    </div>
  );
}

function Result({ course }: { course: GradeCourse }) {
  const o = outlook(course.categories, course.target);
  const allGraded = o.needed === null;
  let headline: string;
  let tone: 'ok' | 'warn' | 'default' = 'default';
  if (o.totalWeight === 0) headline = 'Add the parts of your grade to see what you need.';
  else if (allGraded) headline = `Your final grade is ${fmt(o.earned)}%, a ${letterFor(o.earned)}.`;
  else if (o.needed! <= 0) { headline = `You have already locked in ${fmt(course.target)}% or better.`; tone = 'ok'; }
  else if (o.needed! > 100) { headline = `${fmt(course.target)}% is out of reach. It would take ${fmt(o.needed!)}% on what is left, and perfect scores give ${fmtDown(o.best)}%.`; tone = 'warn'; }
  else headline = `You need an average of ${fmt(o.needed!)}% on everything not graded yet.`;

  const ladder = LETTER_CUTOFFS.filter((c) => ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'].includes(c.letter));
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="What you need" description={`Target: ${fmt(course.target)}% (${letterFor(course.target)})`} />
      <p className={cn('font-display text-[24px] leading-8', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn')}>{headline}</p>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-[14px]">
        <div className="rounded-xl bg-surface-3 p-3">
          <dt className="text-muted">So far</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold">{o.current === null ? 'None' : `${fmt(o.current)}%`}</dd>
        </div>
        <div className="rounded-xl bg-surface-3 p-3">
          <dt className="text-muted">Best case</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold">{fmtDown(o.best)}%</dd>
        </div>
        <div className="rounded-xl bg-surface-3 p-3">
          <dt className="text-muted">Worst case</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold">{fmt(o.worst)}%</dd>
        </div>
      </dl>
      {!allGraded && o.totalWeight > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-[17px]">Needed on the rest for each grade</h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {ladder.map((c) => {
              const n = outlook(course.categories, c.min).needed!;
              return (
                <li key={c.letter} className="flex items-center justify-between px-3 py-2 text-[14px]">
                  <span><strong className="font-semibold">{c.letter}</strong> <span className="text-muted">({c.min}%)</span></span>
                  <span className="tnum">{n <= 0 ? <Badge tone="ok">Locked in</Badge> : n > 100 ? <Badge>Out of reach</Badge> : `${fmt(n)}%`}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Note>Cutoffs vary by instructor. Check your syllabus and change the target if yours differ.</Note>
    </Card>
  );
}

export function GradeCalculator() {
  const { gradeCourses, update, setCourse } = useExtras();
  const courses = useProfile((s) => s.courses);
  const [selected, setSelected] = useState(gradeCourses[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const course = gradeCourses.find((c) => c.id === selected) ?? gradeCourses[0];

  const add = (name: string) => {
    const c = newGradeCourse(name.trim().slice(0, 60) || `Course ${gradeCourses.length + 1}`);
    update({ gradeCourses: [...gradeCourses, c] });
    setSelected(c.id);
    setNewName('');
  };
  const suggestions = courses.filter((c) => !gradeCourses.some((g) => g.name.toLowerCase() === c.toLowerCase()));

  const totalWeight = course ? course.categories.reduce((a, c) => a + c.weight, 0) : 0;
  const setCat = (id: string, patch: Partial<GradeCategory>) => course && setCourse(course.id, (c) => ({ ...c, categories: c.categories.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader title="Your class" description="Enter each part of the grade from your syllabus and the scores you have so far." />
        <div className="flex flex-wrap gap-2">
          {gradeCourses.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelected(c.id)} aria-pressed={c.id === course?.id} className={cn('rounded-lg border px-3 py-1.5 text-[14px] font-medium', c.id === course?.id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-surface-3')}>
              {c.name}
            </button>
          ))}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => (e.preventDefault(), add(newName))}>
          <Input aria-label="New class name" placeholder="Class name, like STAT400" value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" variant="secondary"><Icon name="plus" className="size-4" /> Add class</Button>
        </form>
        {suggestions.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-muted">
            From your profile:
            {suggestions.slice(0, 6).map((s) => <Button key={s} variant="link" size="sm" onClick={() => add(s)}>{s}</Button>)}
          </p>
        )}

        {!course ? (
          <div className="mt-5"><Empty>Add a class to start. It begins with four common grade parts you can rename or remove.</Empty></div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Field label="Class name" htmlFor="gcName" className="mt-0">
                <Input id="gcName" value={course.name} maxLength={60} onChange={(e) => setCourse(course.id, (c) => ({ ...c, name: e.target.value }))} />
              </Field>
              <Field label="Grade you want" htmlFor="gcTarget" className="mt-0">
                <div className="flex gap-2">
                  <Select aria-label="Target letter" className="w-24" value={LETTER_CUTOFFS.find((c) => c.min === course.target)?.letter ?? ''} onChange={(e) => { const c = LETTER_CUTOFFS.find((x) => x.letter === e.target.value); if (c) setCourse(course.id, (x) => ({ ...x, target: c.min })); }}>
                    <option value="">Custom</option>
                    {LETTER_CUTOFFS.map((c) => <option key={c.letter} value={c.letter}>{c.letter}</option>)}
                  </Select>
                  <div className="relative w-28">
                    <Input id="gcTarget" type="number" min={0} max={110} step={0.5} value={course.target} onChange={(e) => setCourse(course.id, (c) => ({ ...c, target: Number(e.target.value) || 0 }))} className="pr-8" />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">%</span>
                  </div>
                </div>
              </Field>
            </div>

            <div className="mt-6">
              <div className="mb-2 grid grid-cols-[1fr_88px_1fr_44px] gap-2 text-[13px] font-semibold text-muted max-sm:grid-cols-[1fr_72px_1fr_44px]">
                <span>Part of grade</span><span>Weight %</span><span>Your score</span><span className="sr-only">Remove</span>
              </div>
              <div className="grid gap-2">
                {course.categories.map((cat) => (
                  <div key={cat.id} className="grid grid-cols-[1fr_88px_1fr_44px] items-start gap-2 max-sm:grid-cols-[1fr_72px_1fr_44px]">
                    <Input aria-label="Part name" value={cat.name} maxLength={40} onChange={(e) => setCat(cat.id, { name: e.target.value })} className="h-10" />
                    <Input aria-label={`${cat.name} weight`} type="number" min={0} max={100} value={cat.weight} onChange={(e) => setCat(cat.id, { weight: Math.max(0, Number(e.target.value) || 0) })} className="tnum h-10" />
                    <ScoreInput key={`${cat.id}-${cat.score === null}`} category={cat} onCommit={(score) => setCat(cat.id, { score })} />
                    <button type="button" aria-label={`Remove ${cat.name}`} onClick={() => setCourse(course.id, (c) => ({ ...c, categories: c.categories.filter((x) => x.id !== cat.id) }))} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger">
                      <Icon name="trash" className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCourse(course.id, (c) => ({ ...c, categories: [...c.categories, { id: uid(), name: 'New part', weight: 0, score: null }] }))}><Icon name="plus" className="size-4" /> Add part</Button>
                <span className={cn('tnum text-[14px]', totalWeight === 100 ? 'text-muted' : 'font-semibold text-warn')}>Weights add up to {fmt(totalWeight)}%{totalWeight !== 100 && ', most syllabi total 100%'}</span>
              </div>
              <Note>Leave a score blank if that part is not graded yet. You can type points like 44/50.</Note>
              <Button variant="ghost" size="sm" className="mt-2 text-danger" onClick={() => confirm(`Delete ${course.name}?`) && update({ gradeCourses: gradeCourses.filter((c) => c.id !== course.id) })}>Delete this class</Button>
            </div>
          </>
        )}
      </Card>
      {course && <Result course={course} />}
    </div>
  );
}
