'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { useExtras } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';

import { PROMPTS, QUESTIONS, STYLES, styleFor } from './style';

/** Hinge-style prompts that show on your chat profile. */
export function PromptsCard({ className }: { className?: string }) {
  const p = useProfile();
  const [q, setQ] = useState<string>(PROMPTS.find((x) => !p.prompts.some((y) => y.q === x)) ?? PROMPTS[0]);
  const [a, setA] = useState('');
  const add = () => {
    if (!a.trim()) return toast('Write an answer first.', 'error');
    if (p.prompts.length >= 3) return toast('You can show three prompts. Remove one first.', 'error');
    p.update({ prompts: [...p.prompts.filter((x) => x.q !== q), { q, a: a.trim().slice(0, 140) }] });
    setA('');
    const next = PROMPTS.find((x) => x !== q && !p.prompts.some((y) => y.q === x));
    if (next) setQ(next);
  };
  return (
    <Card className={className}>
      <CardHeader title="Prompts" description="Up to three. People see them when they open your profile in chat." />
      {p.prompts.length > 0 && (
        <ul className="mb-4 grid gap-2">
          {p.prompts.map((pr) => (
            <li key={pr.q} className="flex items-start gap-3 rounded-lg border border-line px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-muted">{pr.q}</p>
                <p className="mt-0.5 text-[15px] leading-6 font-semibold">{pr.a}</p>
              </div>
              <button type="button" aria-label={`Remove ${pr.q}`} onClick={() => p.update({ prompts: p.prompts.filter((x) => x.q !== pr.q) })} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"><Icon name="close" className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {p.prompts.length < 3 && (
        <form className="grid gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
          <Select aria-label="Prompt" value={q} onChange={(e) => setQ(e.target.value)}>
            {PROMPTS.filter((x) => !p.prompts.some((y) => y.q === x)).map((x) => <option key={x}>{x}</option>)}
          </Select>
          <div className="flex gap-2">
            <Input aria-label="Your answer" maxLength={140} value={a} onChange={(e) => setA(e.target.value)} placeholder="Your answer" />
            <Button type="submit" variant="secondary">Add</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** A one-minute quiz that suggests a session length and table vibe. */
export function StyleQuizCard({ className }: { className?: string }) {
  const p = useProfile();
  const [answers, setAnswers] = useState<number[] | null>(null);
  const style = p.studyStyle ? STYLES[p.studyStyle] : null;
  const step = answers?.length ?? 0;
  const choose = (i: number) => {
    const next = [...(answers ?? []), i];
    if (next.length === QUESTIONS.length) {
      const s = styleFor(next);
      p.update({ studyStyle: s.id });
      setAnswers(null);
      toast(`You are a ${s.name}.`);
    } else setAnswers(next);
  };
  return (
    <Card className={className}>
      <CardHeader title="Study style" description={answers ? `Question ${step + 1} of ${QUESTIONS.length}` : 'Six quick questions about how you like to study.'} action={!answers && style ? <Button size="sm" variant="ghost" onClick={() => setAnswers([])}>Retake</Button> : null} />
      {answers ? (
        <div>
          <span className="mb-4 block h-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-ink transition-all" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} /></span>
          <p className="text-[16px] font-semibold">{QUESTIONS[step].q}</p>
          <div className="mt-3 grid gap-2">
            {QUESTIONS[step].options.map((o, i) => (
              <button key={o.label} type="button" onClick={() => choose(i)} className="rounded-lg border border-line px-3.5 py-2.5 text-left text-[14px] hover:border-ink">{o.label}</button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={() => setAnswers(null)}>Cancel</Button>
        </div>
      ) : style ? (
        <div>
          <p className="text-[22px] leading-8 font-semibold tracking-tight">{style.name}</p>
          <p className="mt-1 text-[14px] text-ink-2">{style.blurb}</p>
          <ul className="mt-3 grid gap-1.5">
            {style.tips.map((t) => <li key={t} className="flex gap-2 text-[13px] text-ink-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-ok" />{t}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={p.timer.mode !== 'ready'} onClick={() => (p.setDuration(style.length), toast(`Focus length set to ${style.length} minutes.`))}>Use {style.length} minute sessions</Button>
            <Button size="sm" variant="ghost" onClick={() => (useExtras.getState().update({ dropVibe: style.vibe }), toast('Your drops will default to this vibe.'))}>Use this vibe for drops</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setAnswers([])}>Take the quiz</Button>
      )}
    </Card>
  );
}

