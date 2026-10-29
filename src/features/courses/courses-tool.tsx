'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { AiErrorBox } from '@/features/ai/ui';
import { useExtras, type Lesson, type MiniCourse } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { lessonsOf, planCourse, progressOf, writeLesson } from './logic';

const LESSON_POINTS = 5;
const IDEAS = ['Bayes theorem', 'Supply and demand', 'Organic reaction mechanisms', 'Big-O notation', 'The French Revolution'];

function Bar({ value, total, className }: { value: number; total: number; className?: string }) {
  return <span className={cn('block h-1.5 overflow-hidden rounded-full bg-surface-3', className)}><span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></span>;
}

const saveCourse = (c: MiniCourse) => {
  const x = useExtras.getState();
  x.update({ courses: x.courses.map((o) => (o.id === c.id ? c : o)) });
};
const patchLesson = (c: MiniCourse, id: string, patch: Partial<Lesson>): MiniCourse => ({ ...c, units: c.units.map((u) => ({ ...u, lessons: u.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)) })) });

function LessonView({ course, lesson, onBack, onNext }: { course: MiniCourse; lesson: Lesson; onBack: () => void; onNext: (() => void) | null }) {
  const [state, setState] = useState<{ busy: boolean; error: Error | null }>({ busy: !lesson.body, error: null });
  const [picks, setPicks] = useState<(number | null)[]>(() => lesson.quiz.map(() => null));
  useEffect(() => {
    if (lesson.body) return;
    let live = true;
    writeLesson(course, lesson)
      .then((r) => {
        saveCourse(patchLesson(useExtras.getState().courses.find((c) => c.id === course.id) ?? course, lesson.id, r));
        if (!live) return;
        setPicks(r.quiz.map(() => null));
        setState({ busy: false, error: null });
      })
      .catch((e: Error) => live && setState({ busy: false, error: e }));
    return () => {
      live = false;
    };
    // Write each lesson once, when it is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  const answered = picks.every((p) => p !== null) && picks.length > 0;
  const score = lesson.quiz.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);

  const finish = () => {
    const fresh = useExtras.getState().courses.find((c) => c.id === course.id) ?? course;
    if (!lesson.done) {
      const p = useProfile.getState();
      p.update({ points: p.points + LESSON_POINTS });
      toast(`Lesson done. +${LESSON_POINTS} points`);
    }
    saveCourse(patchLesson(fresh, lesson.id, { done: true, score: lesson.quiz.length ? score : null }));
    if (onNext) onNext();
    else onBack();
  };

  return (
    <article className="mx-auto max-w-[70ch]">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> {course.title}</button>
      <h2 className="text-[24px] leading-8">{lesson.title}</h2>
      {lesson.goal && <p className="mt-1 text-[14px] text-muted">{lesson.goal}</p>}
      <div className="mt-5">
        {state.busy ? <Thinking label="Writing your lesson" /> : state.error ? <AiErrorBox error={state.error} /> : <Markdown>{lesson.body}</Markdown>}
      </div>
      {!state.busy && lesson.quiz.length > 0 && (
        <section className="mt-8 grid gap-4 border-t border-line pt-6">
          <h3 className="text-[16px] font-semibold">Check yourself</h3>
          {lesson.quiz.map((q, qi) => (
            <div key={qi}>
              <p className="mb-2 text-[15px] font-medium">{qi + 1}. {q.q}</p>
              <div className="grid gap-1.5">
                {q.options.map((o, oi) => {
                  const picked = picks[qi] === oi;
                  const reveal = picks[qi] !== null;
                  return (
                    <button key={oi} type="button" disabled={reveal} onClick={() => setPicks(picks.map((p, i) => (i === qi ? oi : p)))} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[14px] transition-colors', reveal && oi === q.answer ? 'border-ok bg-ok-soft text-ok' : picked ? 'border-danger bg-danger/10 text-danger' : 'border-line hover:border-ink/30', reveal && 'cursor-default')}>
                      {reveal && oi === q.answer ? <Icon name="check" className="size-4 shrink-0" /> : picked ? <Icon name="close" className="size-4 shrink-0" /> : <span className="size-4 shrink-0 rounded-full border border-line-strong" />}
                      {o}
                    </button>
                  );
                })}
              </div>
              {picks[qi] !== null && q.why && <p className="mt-1.5 text-[13px] text-muted">{q.why}</p>}
            </div>
          ))}
        </section>
      )}
      {!state.busy && !state.error && (
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="tnum text-[13px] text-muted">{answered ? `${score} of ${lesson.quiz.length} right` : ''}</span>
          <Button onClick={finish} disabled={lesson.quiz.length > 0 && !answered}>{onNext ? 'Next lesson' : 'Finish'} <Icon name="arrow" className="size-4" /></Button>
        </div>
      )}
    </article>
  );
}

function CourseView({ course, onBack }: { course: MiniCourse; onBack: () => void }) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const all = lessonsOf(course);
  const { done, total } = progressOf(course);
  const next = all.find((l) => !l.done);
  const lesson = all.find((l) => l.id === lessonId);
  if (lesson) {
    const i = all.indexOf(lesson);
    const after = all[i + 1];
    return <LessonView key={lesson.id} course={course} lesson={lesson} onBack={() => setLessonId(null)} onNext={after ? () => setLessonId(after.id) : null} />;
  }
  return (
    <div className="mx-auto grid max-w-[70ch] gap-5">
      <div>
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> Courses</button>
        <h2 className="text-[24px] leading-8">{course.title}</h2>
        <div className="mt-3 flex items-center gap-3">
          <Bar value={done} total={total} className="flex-1" />
          <span className="tnum text-[13px] text-muted">{done}/{total}</span>
        </div>
        {next && <Button className="mt-4" onClick={() => setLessonId(next.id)}><Icon name="play" className="size-4" /> {done ? 'Continue' : 'Start'}: {next.title}</Button>}
      </div>
      {course.units.map((u, ui) => (
        <section key={ui}>
          <h3 className="mb-1.5 text-[13px] font-semibold text-muted">Unit {ui + 1} · {u.title}</h3>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {u.lessons.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setLessonId(l.id)} className="group flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border', l.done ? 'border-transparent bg-accent-fill text-white' : l.id === next?.id ? 'border-accent text-accent' : 'border-line text-muted')}>
                    <Icon name={l.done ? 'check' : 'play'} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium group-hover:underline">{l.title}</span>
                    {l.done && l.score !== null && <span className="tnum text-[12px] text-muted">{l.score}/{l.quiz.length} on the check</span>}
                  </span>
                  <Icon name="chevron" className="size-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <button type="button" className="justify-self-start text-[13px] text-muted hover:text-danger" onClick={() => { if (confirm(`Delete “${course.title}”?`)) { const x = useExtras.getState(); x.update({ courses: x.courses.filter((c) => c.id !== course.id) }); onBack(); } }}>Delete course</button>
    </div>
  );
}

/** Short courses made by the AI: a topic becomes units, lessons and quick checks. */
export function CoursesTool() {
  const courses = useExtras((s) => s.courses);
  const [openId, setOpenId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const open = courses.find((c) => c.id === openId);
  if (open) return <CourseView course={open} onBack={() => setOpenId(null)} />;

  const make = async (t = topic) => {
    if (!t.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const c = await planCourse(t.trim());
      const x = useExtras.getState();
      x.update({ courses: [c, ...x.courses].slice(0, 30) });
      setTopic('');
      setOpenId(c.id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form className="rounded-xl border border-line bg-surface p-4" onSubmit={(e) => (e.preventDefault(), void make())}>
        <label htmlFor="courseTopic" className="text-[15px] font-semibold">What do you want to learn?</label>
        <div className="mt-2 flex gap-2">
          <Input id="courseTopic" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} placeholder="Any topic" className="h-10" />
          <Button type="submit" loading={busy} disabled={!topic.trim()}><Icon name="sparkle" className="size-4" /> Make course</Button>
        </div>
        {!courses.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {IDEAS.map((t) => <button key={t} type="button" onClick={() => (setTopic(t), void make(t))} className="rounded-md border border-line px-2.5 py-1 text-[13px] text-ink-2 hover:border-ink/30">{t}</button>)}
          </div>
        )}
        {busy && <div className="mt-3"><Thinking label="Planning your course" /></div>}
        {error && <div className="mt-3"><AiErrorBox error={error} /></div>}
      </form>
      {courses.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => {
            const { done, total } = progressOf(c);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} className="flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-ink/25">
                  <span className="flex items-center gap-2 text-[12px] text-muted"><Icon name="layers" className="size-3.5" /> {c.units.length} units · {total} lessons</span>
                  <strong className="mt-1 line-clamp-2 text-[16px] leading-6 font-semibold">{c.title}</strong>
                  <span className="mt-auto flex items-center gap-3 pt-4">
                    <Bar value={done} total={total} className="flex-1" />
                    <span className="tnum text-[12px] text-muted">{done === total ? 'Done' : `${done}/${total}`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
