'use client';
import { useState } from 'react';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Note, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { AiError, callJSON } from '@/lib/ai/client';
import { useAi } from '@/lib/stores/ai';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { cn, fmtMinutes, plural, uid } from '@/lib/utils';
import { BlockRow } from './block-row';
import { examPlan, readiness, sessionsFor, upcomingExams, type Confidence, type ExamInfo, type Topic } from './exam-prep';
import { startOfDay, studyWindow, type Proposal } from './plan';
import { ProposalList } from './proposal-list';
import { courseName } from './routine';
import { allEvents, busyTimes } from './sync';

const DAY = 86_400_000;
const CONF: { value: Confidence; label: string; cls: string }[] = [
  { value: 'new', label: 'New to me', cls: 'bg-danger-soft text-danger border-danger/30' },
  { value: 'shaky', label: 'Shaky', cls: 'bg-warn-soft text-warn border-warn/30' },
  { value: 'solid', label: 'Got it', cls: 'bg-ok-soft text-ok border-ok/30' },
];

const SYSTEM = (level: string) =>
  `You help a ${level} student prepare for an exam. List the 4 to 10 topics most likely to be on it, in the order they should be studied (foundations first). Use the course materials if given; otherwise use what is standard for this course. Estimate minutes to learn each from scratch (30 to 90). Reply with JSON only: {"topics":[{"name":"...","minutes":45}]}. Topic names are short and specific, like "Conditional probability and Bayes' rule", not "Chapter 2".`;

export const useExams = () => {
  const reminders = useProfile((s) => s.reminders);
  const feeds = useExtras((s) => s.calendarFeeds);
  const now = useNow(60_000);
  return upcomingExams({ reminders, events: allEvents(feeds), now });
};

const daysUntil = (at: number, now: number) => Math.round((startOfDay(at) - startOfDay(now)) / DAY);
const countdown = (at: number, now: number) => { const d = daysUntil(at, now); return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`; };

/** Pick an exam, list what to work on, and get a schedule that finishes before it. */
export function ExamPrepCard({ initial }: { initial?: string | null }) {
  const x = useExtras();
  const level = useAi((s) => s.level);
  const p = useProfile();
  const exams = useExams();
  const now = useNow(60_000);
  const [key, setKey] = useState(initial ?? '');
  const exam: ExamInfo | undefined = exams.find((e) => e.key === key) ?? exams[0];
  const [name, setName] = useState('');
  const [material, setMaterial] = useState('');
  const [showMaterial, setShowMaterial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  if (!exams.length) return <Card><CardHeader title="Exam prep" description="Tell Studytime what is on an exam and it plans every session you need, finishing the day before." /><Empty>No upcoming exams. Add one under Deadlines, or connect Canvas or your class calendar.</Empty></Card>;
  if (!exam) return null;

  const prep = x.examPreps[exam.key] ?? { topics: [] };
  const topics = prep.topics as Topic[];
  const save = (t: Topic[]) => x.update({ examPreps: { ...useExtras.getState().examPreps, [exam.key]: { ...prep, topics: t } } });
  const mine = x.studyBlocks.filter((b) => b.reminderId === exam.key && b.source === 'exam');
  const upcoming = mine.filter((b) => b.end > now);
  const ready = readiness(topics, x.studyBlocks, exam.key);
  const need = sessionsFor(topics);
  const needMinutes = need.reduce((n, s) => n + s.minutes, 0) + (topics.length ? 90 : 0);
  const days = Math.max(0, daysUntil(exam.at, now));

  const findTopics = async () => {
    setBusy(true);
    try {
      const course = courseName(exam.title);
      const r = await callJSON<{ topics: { name: string; minutes: number }[] }>({ tier: 'fast', maxTokens: 900, system: SYSTEM(level), messages: [{ role: 'user', content: `Exam: ${exam.title}\nCourse: ${course}${p.major ? `\nStudent's major: ${p.major}` : ''}\n${material.trim() ? `Course materials (syllabus, study guide or notes):\n${material.trim().slice(0, 12000)}` : 'No materials given.'}` }] });
      const found = (r.topics || []).slice(0, 12).map((t) => ({ id: uid(), name: String(t.name).slice(0, 80), conf: 'new' as const, minutes: Math.min(90, Math.max(30, Math.round((Number(t.minutes) || 45) / 5) * 5)) }));
      if (!found.length) throw new Error('No topics came back. Paste the study guide and try again.');
      const have = new Set(topics.map((t) => t.name.toLowerCase()));
      save([...topics, ...found.filter((t) => !have.has(t.name.toLowerCase()))]);
      setShowMaterial(false);
      toast(`${plural(found.length, 'topic')} added. Mark how well you know each one.`);
    } catch (e) {
      toast(e instanceof AiError && e.needsSetup ? 'Connect the AI tutor in Settings first, or add topics by hand.' : (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const build = () => {
    // Rebuilding replaces the prep blocks you have not done yet.
    const keep = x.studyBlocks.filter((b) => !(b.reminderId === exam.key && b.source === 'exam' && !b.done && b.start > Date.now()));
    if (keep.length !== x.studyBlocks.length) x.update({ studyBlocks: keep });
    const { proposals: out, missing } = examPlan({ exam, topics, now: Date.now(), win: studyWindow(x.planPrefs, x.windDown), busy: busyTimes(x.calendarFeeds), planned: keep.filter((b) => b.end > Date.now()), maxPerDay: x.planPrefs.maxPerDay });
    setProposals(out);
    if (missing) toast(`${plural(missing, 'session')} did not fit before the exam. Raise "most study per day" in Plan study time, or mark topics you know.`, 'error');
    else if (!out.length) toast('There is no free time left before this exam.', 'error');
  };

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Exams">
        {exams.slice(0, 8).map((e) => {
          const r = readiness((x.examPreps[e.key]?.topics ?? []) as Topic[], x.studyBlocks, e.key);
          const on = e.key === exam.key;
          return (
            <button key={e.key} type="button" role="tab" aria-selected={on} onClick={() => (setKey(e.key), setProposals(null))} className={cn('min-w-[170px] shrink-0 rounded-xl border px-3.5 py-2.5 text-left', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}>
              <span className="block truncate text-[14px] font-semibold">{e.title}</span>
              <span className="tnum block text-[12px] text-muted">{countdown(e.at, now)}{r !== null ? ` · ${r}% ready` : ' · not planned'}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={exam.title}
          description={`${new Date(exam.at).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${countdown(exam.at, now)}`}
          action={ready !== null && (
            <div className="w-40">
              <div className="flex justify-between text-[12px]"><span className="text-muted">Ready</span><span className="tnum font-semibold">{ready}%</span></div>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-3"><span className={cn('block h-full rounded-full', ready >= 75 ? 'bg-ok' : ready >= 40 ? 'bg-accent-fill' : 'bg-warn')} style={{ width: `${ready}%` }} /></span>
            </div>
          )}
        />

        <h3 className="mb-2 text-[14px] font-semibold">What to work on</h3>
        {topics.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {topics.map((t, i) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="tnum w-5 text-[12px] text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 text-[14px] font-medium">{t.name}</span>
                <span className="flex gap-1" role="radiogroup" aria-label={`How well you know ${t.name}`}>
                  {CONF.map((c) => (
                    <button key={c.value} type="button" role="radio" aria-checked={t.conf === c.value} onClick={() => save(topics.map((y) => (y.id === t.id ? { ...y, conf: c.value } : y)))} className={cn('rounded-md border px-2 py-0.5 text-[12px] font-medium', t.conf === c.value ? c.cls : 'border-line text-muted hover:text-ink')}>{c.label}</button>
                  ))}
                </span>
                <Select aria-label={`Minutes for ${t.name}`} className="h-8 w-[84px] text-[12px]" value={t.minutes} onChange={(e) => save(topics.map((y) => (y.id === t.id ? { ...y, minutes: Number(e.target.value) } : y)))}>{[30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</Select>
                <button type="button" aria-label={`Remove ${t.name}`} onClick={() => save(topics.filter((y) => y.id !== t.id))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-danger"><Icon name="close" className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        ) : <Empty title="No topics yet">Let the AI suggest them from the course, or paste your study guide for a closer match. You can also add them one by one.</Empty>}

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; save([...topics, { id: uid(), name: name.trim().slice(0, 80), conf: 'new', minutes: 45 }]); setName(''); }}>
          <Input aria-label="Add a topic" placeholder="Add a topic, like Hypothesis testing" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy} onClick={() => (showMaterial || topics.length ? findTopics() : setShowMaterial(true))}><Icon name="sparkle" className="size-4" /> {topics.length ? 'Suggest more topics' : 'Find topics with AI'}</Button>
          {!showMaterial && <Button variant="ghost" onClick={() => setShowMaterial(true)}>Paste a study guide</Button>}
        </div>
        {showMaterial && (
          <div className="mt-3">
            <Textarea rows={5} aria-label="Study guide or syllabus" placeholder="Paste the study guide, syllabus section or lecture list. Optional, but it makes the topics match your class." value={material} onChange={(e) => setMaterial(e.target.value)} />
            <Button className="mt-2" loading={busy} onClick={findTopics}>Find topics</Button>
          </div>
        )}

        {topics.length > 0 && (
          <div className="mt-5 rounded-xl bg-surface-2 p-4">
            <p className="text-[14px]"><strong className="font-semibold">{plural(need.length + 2, 'session')}, about {fmtMinutes(needMinutes)}</strong> <span className="text-muted">over the {days > 1 ? `${days} days` : 'time'} left. Topics in order, a practice exam two days before, a light review the day before.</span></p>
            <Button className="mt-3" onClick={build}><Icon name="calendar" className="size-4" /> {upcoming.length ? 'Rebuild my plan' : 'Build my exam plan'}</Button>
            {proposals && <ProposalList key={proposals.length + String(proposals[0]?.start)} proposals={proposals} onDone={() => setProposals(null)} />}
          </div>
        )}
      </Card>

      {mine.length > 0 && (
        <Card>
          <CardHeader title="Your plan" description={`${mine.filter((b) => b.done).length} of ${mine.length} sessions done. Mark them done as you go and your readiness goes up.`} />
          {mine.map((b) => <BlockRow key={b.id} b={b} />)}
        </Card>
      )}
      <Note>Tip: rate topics honestly. &ldquo;Got it&rdquo; topics skip straight to the final review, so the time goes where you need it.</Note>
    </div>
  );
}
