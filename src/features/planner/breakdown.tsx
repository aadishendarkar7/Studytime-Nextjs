'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardHeader, Empty } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Note, Select, Textarea } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Bar } from '@/components/ui/progress';
import { planSessions, studyWindow, type Proposal } from '@/features/calendar/plan';
import { acceptProposals, busyTimes } from '@/features/calendar/sync';
import { AiError, callAI } from '@/lib/ai/client';
import { useAi } from '@/lib/stores/ai';
import { useExtras, type BreakdownStep } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { useNow } from '@/lib/use-now';
import { cn, parseJSONLoose, uid } from '@/lib/utils';

const SYSTEM = (level: string) =>
  `You help a ${level} student plan an assignment. Split it into 3 to 8 concrete steps in the order they should be done, each small enough to finish in one sitting. Estimate minutes for each (15 to 120). Reply with JSON only: {"steps":[{"text":"...","minutes":45}]}. Steps start with a verb and are specific to this assignment, for example "Outline the three main arguments" rather than "Research".`;

/** Schedules each unfinished step as its own block, in order, before the deadline. */
function scheduleSteps(reminderId: string, title: string, dueAt: number, steps: BreakdownStep[]) {
  const x = useExtras.getState();
  const win = studyWindow(x.planPrefs, x.windDown);
  const busy = busyTimes(x.calendarFeeds);
  const out: (Proposal & { stepId: string })[] = [];
  const notBefore = Date.now();
  for (const s of steps.filter((s) => !s.done && !s.blockId)) {
    const [p] = planSessions({ title: `${title}: ${s.text}`, subject: title, dueAt, count: 1, minutes: Math.min(120, Math.max(15, s.minutes)), now: notBefore, win, busy, planned: [...x.studyBlocks, ...out], maxPerDay: x.planPrefs.maxPerDay, reminderId, source: 'step' });
    if (!p) break;
    // planSessions works back from the deadline; keep steps in order by pushing the next one after this one.
    out.push({ ...p, stepId: s.id });
  }
  out.sort((a, b) => a.start - b.start);
  const ordered = steps.filter((s) => out.some((o) => o.stepId === s.id));
  const blocks = acceptProposals(out.map((o, i) => ({ ...o, title: `${title}: ${ordered[i].text}` })));
  const ids = new Map(ordered.map((s, i) => [s.id, blocks[i].id]));
  return { steps: steps.map((s) => (ids.has(s.id) ? { ...s, blockId: ids.get(s.id) } : s)), count: blocks.length, missing: steps.filter((s) => !s.done && !s.blockId).length - blocks.length };
}

export function Breakdown() {
  const reminders = useProfile((s) => s.reminders);
  const level = useAi((s) => s.level);
  const { breakdowns, update } = useExtras();
  const now = useNow();
  const open = reminders.filter((r) => !r.done && r.dueAt > now).sort((a, b) => a.dueAt - b.dueAt);
  const [id, setId] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const target = open.find((r) => r.id === id) ?? open[0];
  const withSteps = open.filter((r) => breakdowns[r.id]?.length);

  const setSteps = (rid: string, steps: BreakdownStep[]) => update({ breakdowns: { ...useExtras.getState().breakdowns, [rid]: steps } });

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const text = await callAI({ tier: 'fast', maxTokens: 900, system: SYSTEM(level), messages: [{ role: 'user', content: `Assignment: ${target.title} (${target.type}), due ${new Date(target.dueAt).toLocaleString()}.\n${details.trim() ? `Details from the student:\n${details.trim().slice(0, 4000)}` : 'No extra details.'}` }] });
      const parsed = parseJSONLoose<{ steps: { text: string; minutes: number }[] }>(text);
      const steps = (parsed.steps || []).slice(0, 10).map((s) => ({ id: uid(), text: String(s.text).slice(0, 140), minutes: Math.min(120, Math.max(15, Math.round(Number(s.minutes) || 30))), done: false }));
      if (!steps.length) throw new Error('The AI did not return any steps. Try adding details.');
      setSteps(target.id, steps);
      setDetails('');
      toast(`Broken into ${steps.length} steps.`);
    } catch (e) {
      toast(e instanceof AiError && e.needsSetup ? 'Connect the AI tutor in Settings first, or add steps by hand.' : (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="breakdown" className="mt-5">
      <CardHeader title="Break it down" description="Big assignments feel smaller as a list of steps. The AI can suggest steps, then Studytime schedules each one before the due date." />
      {open.length ? (
        <div className="grid gap-x-6 lg:grid-cols-2">
          <div>
            <Field label="Assignment" htmlFor="bdTarget" className="mt-0"><Select id="bdTarget" value={target?.id} onChange={(e) => setId(e.target.value)}>{open.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</Select></Field>
            <Field label="Instructions or details" hint="optional, paste from the assignment" htmlFor="bdDetails"><Textarea id="bdDetails" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Write a 6-page paper comparing..." /></Field>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={run} loading={busy}>Break it down with AI</Button>
            </div>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!target || !manual.trim()) return; setSteps(target.id, [...(breakdowns[target.id] ?? []), { id: uid(), text: manual.trim().slice(0, 140), minutes: 45, done: false }]); setManual(''); }}>
              <Input aria-label="Add a step by hand" placeholder="Or add a step yourself" value={manual} maxLength={140} onChange={(e) => setManual(e.target.value)} />
              <Button type="submit" variant="secondary">Add</Button>
            </form>
            <Note>AI features need a free key. <Link href="/settings#ai" className="underline underline-offset-4">Set it up in Settings</Link>.</Note>
          </div>
          <div className="mt-6 grid content-start gap-4 lg:mt-0">
            {withSteps.length ? withSteps.map((r) => {
              const steps = breakdowns[r.id];
              const done = steps.filter((s) => s.done).length;
              return (
                <section key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[17px] leading-6">{r.title}</h3>
                    <span className="tnum shrink-0 text-[13px] text-muted">{done}/{steps.length}</span>
                  </div>
                  <Bar value={(done / steps.length) * 100} className="mt-2" />
                  <ol className="mt-3 grid gap-1">
                    {steps.map((s) => (
                      <li key={s.id} className="flex items-center gap-2.5 text-[14px]">
                        <input type="checkbox" className="size-4 shrink-0 accent-[var(--accent)]" checked={s.done} aria-label={s.text} onChange={(e) => setSteps(r.id, steps.map((x) => (x.id === s.id ? { ...x, done: e.target.checked } : x)))} />
                        <span className={cn('min-w-0 flex-1', s.done && 'text-muted line-through')}>{s.text}</span>
                        <span className="tnum shrink-0 text-[12px] text-muted">{s.minutes} min{s.blockId ? ', scheduled' : ''}</span>
                        <button type="button" aria-label={`Remove step ${s.text}`} onClick={() => setSteps(r.id, steps.filter((x) => x.id !== s.id))} className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-3 max-sm:size-11"><Icon name="close" className="size-3.5" /></button>
                      </li>
                    ))}
                  </ol>
                  <Button size="sm" variant="secondary" className="mt-3" disabled={steps.every((s) => s.done || s.blockId)} onClick={() => {
                    const res = scheduleSteps(r.id, r.title, r.dueAt, steps);
                    setSteps(r.id, res.steps);
                    toast(res.count ? `Scheduled ${res.count} steps on your calendar.${res.missing > 0 ? ` ${res.missing} did not fit before the due date.` : ''}` : 'No free time left before the due date.', res.count ? 'default' : 'error');
                  }}>Schedule steps</Button>
                </section>
              );
            }) : <Empty>Pick an assignment and break it down. Steps you finish here show your progress.</Empty>}
          </div>
        </div>
      ) : <Empty>Add an upcoming assignment or exam above, or connect Canvas in Calendar.</Empty>}
    </Card>
  );
}
