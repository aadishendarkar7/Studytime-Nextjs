'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Markdown } from '@/components/ui/markdown';
import { Thinking } from '@/components/ui/progress';
import { AiErrorBox } from '@/features/ai/ui';
import { useExtras, type Lesson, type MiniCourse } from '@/lib/stores/extras';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { cn } from '@/lib/utils';
import { lessonsOf, planCourse, progressOf, writeLesson } from './logic';
import { askConfirm } from '@/lib/stores/ask';

const LESSON_POINTS = 5;
const IDEAS = ['Bayes theorem', 'Supply and demand', 'Organic reaction mechanisms', 'Big-O notation', 'The French Revolution', 'How vaccines work'];

/** Each course gets its own cover color, picked from a small set of deep tones so white text always reads. */
const COVERS = ['#2f6b4f', '#2f5b8a', '#6b3f6e', '#9a4a2a', '#1f6a6a', '#4a4f8a', '#7a5a1f'];
const coverOf = (id: string) => COVERS[[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7) % COVERS.length];
const cover = (id: string): CSSProperties => ({ background: coverOf(id) });

const saveCourse = (c: MiniCourse) => {
  const x = useExtras.getState();
  x.update({ courses: x.courses.map((o) => (o.id === c.id ? c : o)) });
};
const patchLesson = (c: MiniCourse, id: string, patch: Partial<Lesson>): MiniCourse => ({ ...c, units: c.units.map((u) => ({ ...u, lessons: u.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)) })) });

/** A ring that fills as lessons are finished, with the share in the middle. */
function Ring({ done, total, size = 56, light = false }: { done: number; total: number; size?: number; light?: boolean }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} lessons done`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" stroke={light ? 'rgb(255 255 255 / 0.25)' : 'var(--surface-3)'} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke={light ? '#fff' : 'var(--accent-fill)'} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className={cn('tnum absolute text-[13px] font-semibold', light ? 'text-white' : 'text-ink')}>{Math.round(pct * 100)}%</span>
    </span>
  );
}

/** One lesson: the reading, a three-question check, then on to the next one. */
function LessonView({ course, lesson, onBack, onNext }: { course: MiniCourse; lesson: Lesson; onBack: () => void; onNext: (() => void) | null }) {
  const [state, setState] = useState<{ busy: boolean; error: Error | null }>({ busy: !lesson.body, error: null });
  const [picks, setPicks] = useState<(number | null)[]>(() => lesson.quiz.map(() => null));
  const [attempt, setAttempt] = useState(0);
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
    // Write each lesson once when it is first opened, and again on Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, attempt]);
  const all = lessonsOf(course);
  const index = all.findIndex((l) => l.id === lesson.id);
  const unitIndex = course.units.findIndex((u) => u.lessons.some((l) => l.id === lesson.id));
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
    <article className="mx-auto max-w-[72ch]">
      {/* Where you are: back to the course, and one segment per lesson. */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> {course.title}</button>
        <span className="tnum ml-auto text-[12px] text-muted">Lesson {index + 1} of {all.length}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {all.map((l, i) => <span key={l.id} className={cn('h-1 flex-1 rounded-full', i === index ? 'bg-ink' : l.done ? 'bg-accent-fill' : 'bg-surface-3')} />)}
      </div>

      <header className="mt-6 rounded-[10px] px-5 py-5 text-white" style={cover(course.id)}>
        <p className="text-[13px] font-medium text-white/75">Unit {unitIndex + 1}: {course.units[unitIndex]?.title}</p>
        <h2 className="mt-1 text-[26px] leading-8 font-semibold tracking-tight max-sm:text-[22px]">{lesson.title}</h2>
        {lesson.goal && <p className="mt-2 text-[14px] leading-5 text-white/85">After this you can {lesson.goal.charAt(0).toLowerCase() + lesson.goal.slice(1)}</p>}
        <p className="mt-3 text-[12px] font-medium text-white/70">About 10 minutes, then 3 quick questions</p>
      </header>

      <div className="mt-6">
        {state.busy ? (
          <div className="grid gap-3 py-2" aria-busy="true">
            <Thinking label="Writing your lesson" />
            {[90, 100, 75, 95, 60].map((w, i) => <span key={i} className="h-3 animate-pulse rounded bg-surface-3" style={{ width: `${w}%` }} />)}
          </div>
        ) : state.error ? (
          <div className="grid justify-items-start gap-3"><AiErrorBox error={state.error} /><Button variant="secondary" onClick={() => (setState({ busy: true, error: null }), setAttempt(attempt + 1))}>Try again</Button></div>
        ) : (
          <Markdown>{lesson.body}</Markdown>
        )}
      </div>

      {!state.busy && lesson.quiz.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-[10px] border border-line">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" style={cover(course.id)}>
            <h3 className="text-[15px] font-semibold">Check yourself</h3>
            <span className="tnum text-[13px] text-white/80">{answered ? `${score} of ${lesson.quiz.length} right` : `${picks.filter((p) => p !== null).length} of ${lesson.quiz.length} answered`}</span>
          </div>
          <ol className="divide-y divide-line">
            {lesson.quiz.map((q, qi) => (
              <li key={qi} className="px-4 py-4">
                <p className="text-[15px] font-medium">{qi + 1}. {q.q}</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o, oi) => {
                    const reveal = picks[qi] !== null;
                    const right = reveal && oi === q.answer;
                    const wrong = picks[qi] === oi && oi !== q.answer;
                    return (
                      <button key={oi} type="button" disabled={reveal} onClick={() => setPicks(picks.map((p, i) => (i === qi ? oi : p)))} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left text-[14px] transition-colors', right ? 'border-ok bg-ok-soft text-ok' : wrong ? 'border-danger bg-danger-soft text-danger' : reveal ? 'border-line text-muted' : 'border-line hover:border-ink')}>
                        {right ? <Icon name="check" className="size-4 shrink-0" /> : wrong ? <Icon name="close" className="size-4 shrink-0" /> : null}
                        {o}
                      </button>
                    );
                  })}
                </div>
                {picks[qi] !== null && q.why && <p className="mt-2 text-[13px] text-muted">{picks[qi] === q.answer ? 'Right. ' : 'Not quite. '}{q.why}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {!state.busy && !state.error && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-[13px] text-muted">{lesson.quiz.length > 0 && !answered ? 'Answer the questions to finish.' : lesson.done ? 'You finished this lesson before.' : `Finishing earns ${LESSON_POINTS} points.`}</span>
          <Button size="lg" onClick={finish} disabled={lesson.quiz.length > 0 && !answered}>{onNext ? 'Next lesson' : 'Finish course'}</Button>
        </div>
      )}
    </article>
  );
}

/** A course as a path: units in order, lessons as stops, the next one marked. */
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
  const remove = async () => {
    if (!await askConfirm(`Delete “${course.title}”? This cannot be undone.`)) return;
    const x = useExtras.getState();
    x.update({ courses: x.courses.filter((c) => c.id !== course.id) });
    onBack();
  };
  return (
    <div className="mx-auto grid max-w-[72ch] gap-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 justify-self-start text-[13px] font-medium text-muted hover:text-ink"><Icon name="chevron" className="size-3.5 rotate-180" /> All courses</button>

      <header className="rounded-[10px] px-5 py-6 text-white max-sm:px-4" style={cover(course.id)}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-white/75">{course.units.length} {course.units.length === 1 ? 'unit' : 'units'}, {total} {total === 1 ? 'lesson' : 'lessons'}, about {total * 10} minutes</p>
            <h2 className="mt-1 text-[28px] leading-9 font-semibold tracking-tight max-sm:text-[22px] max-sm:leading-7">{course.title}</h2>
          </div>
          <Ring done={done} total={total} size={64} light />
        </div>
        {next ? (
          <button type="button" onClick={() => setLessonId(next.id)} className="mt-5 flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-[#111] transition-colors hover:bg-white/90">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-black/55">{done ? 'Continue with' : 'Start with'}</span>
              <span className="block truncate text-[15px] font-semibold">{next.title}</span>
            </span>
            <Icon name="play" className="size-5 shrink-0" />
          </button>
        ) : (
          <p className="mt-5 rounded-lg bg-white/15 px-4 py-3 text-[15px] font-semibold">Course complete. Every lesson is done.</p>
        )}
      </header>

      <ol className="grid gap-6">
        {course.units.map((u, ui) => {
          const unitDone = u.lessons.every((l) => l.done);
          return (
            <li key={ui}>
              <div className="mb-3 flex items-baseline gap-3">
                <span className={cn('tnum grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold', unitDone ? 'bg-accent-fill text-white' : 'bg-ink text-bg')}>{unitDone ? <Icon name="check" className="size-4" /> : ui + 1}</span>
                <h3 className="text-[17px] font-semibold">{u.title}</h3>
                <span className="tnum ml-auto text-[12px] text-muted">{u.lessons.filter((l) => l.done).length}/{u.lessons.length}</span>
              </div>
              {/* The path: a line down the left joins the stops. */}
              <ol className="relative ml-[13px] border-l-2 border-line pl-6">
                {u.lessons.map((l) => {
                  const isNext = l.id === next?.id;
                  return (
                    <li key={l.id} className="relative pb-2 last:pb-0">
                      <span className={cn('absolute top-3.5 -left-[33px] grid size-4 place-items-center rounded-full border-2', l.done ? 'border-accent-fill bg-accent-fill' : isNext ? 'border-ink bg-surface' : 'border-line-strong bg-surface')} aria-hidden="true">
                        {l.done && <Icon name="check" className="size-2.5 text-white" />}
                      </span>
                      <button type="button" onClick={() => setLessonId(l.id)} className={cn('group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors', isNext ? 'border-ink bg-surface' : 'border-transparent hover:border-line hover:bg-surface')}>
                        <span className="min-w-0 flex-1">
                          {isNext && <span className="mb-0.5 block text-[12px] font-semibold text-accent-ink">Up next</span>}
                          <span className={cn('block truncate text-[15px] font-medium', l.done && 'text-ink-2')}>{l.title}</span>
                          <span className="tnum block truncate text-[12px] text-muted">{l.done ? (l.score !== null ? `Done, ${l.score}/${l.quiz.length} on the check` : 'Done') : l.goal || 'About 10 minutes'}</span>
                        </span>
                        <Icon name="chevron" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
      <button type="button" className="justify-self-start text-[13px] text-muted hover:text-danger" onClick={remove}>Delete this course</button>
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
    if (!t.trim() || busy) return;
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
  // The course you were last working through: the newest one that is started but not finished.
  const current = courses.find((c) => {
    const p = progressOf(c);
    return p.done > 0 && p.done < p.total;
  });
  const currentNext = current ? lessonsOf(current).find((l) => !l.done) : null;
  const rest = courses.filter((c) => c.id !== current?.id);

  return (
    <div className="grid gap-8">
      {/* Make a course: the main action, so it gets the color. */}
      <section className="rounded-[12px] bg-accent-fill px-6 py-7 text-white max-sm:px-4 max-sm:py-5">
        <p className="text-[13px] font-medium text-white/75">Courses</p>
        <h2 className="mt-1 max-w-[22ch] text-[30px] leading-9 font-semibold tracking-tight max-sm:text-[24px] max-sm:leading-8">Learn anything in 10-minute lessons</h2>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-6 text-white/80">Type a topic. You get a short course with units, lessons in order from basics to harder ideas, and a quick check after each one.</p>
        <form className="mt-5 flex gap-2 rounded-lg bg-white p-1.5 max-sm:flex-col" onSubmit={(e) => (e.preventDefault(), void make())}>
          <label htmlFor="courseTopic" className="sr-only">What do you want to learn?</label>
          <input id="courseTopic" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} placeholder="What do you want to learn?" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[16px] text-[#111] outline-none placeholder:text-black/40" />
          <button type="submit" disabled={!topic.trim() || busy} className="h-11 rounded-md bg-ink px-5 text-[15px] font-semibold text-bg transition-opacity disabled:opacity-40">{busy ? 'Building your course' : 'Build course'}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {IDEAS.map((t) => <button key={t} type="button" disabled={busy} onClick={() => (setTopic(t), void make(t))} className="rounded-md border border-white/35 px-2.5 py-1 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50">{t}</button>)}
        </div>
        {busy && (
          <div className="mt-5 grid gap-2 rounded-lg bg-white/10 p-4" aria-busy="true">
            <p className="text-[14px] font-medium">Planning units and lessons for “{topic || 'your topic'}”</p>
            {[70, 55, 80].map((w, i) => <span key={i} className="h-2.5 animate-pulse rounded bg-white/25" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />)}
          </div>
        )}
        {error && <div className="mt-4 rounded-lg bg-white p-1"><AiErrorBox error={error} /></div>}
      </section>

      {current && currentNext && (
        <section>
          <h3 className="mb-3 text-[17px] font-semibold">Continue learning</h3>
          <button type="button" onClick={() => setOpenId(current.id)} className="group flex w-full items-center gap-5 overflow-hidden rounded-[10px] border border-line bg-surface text-left transition-colors hover:border-line-strong max-sm:flex-col max-sm:items-stretch max-sm:gap-0">
            <span className="flex w-48 shrink-0 items-center justify-center self-stretch py-6 max-sm:w-full" style={cover(current.id)}>
              <Ring done={progressOf(current).done} total={progressOf(current).total} size={72} light />
            </span>
            <span className="min-w-0 flex-1 py-5 pr-5 max-sm:p-4">
              <span className="block truncate text-[18px] font-semibold">{current.title}</span>
              <span className="mt-1 block truncate text-[14px] text-muted">Up next: {currentNext.title}</span>
              <span className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-semibold text-bg">Continue <Icon name="play" className="size-4" /></span>
            </span>
          </button>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[17px] font-semibold">{current ? 'Your other courses' : 'Your courses'}</h3>
            <span className="tnum text-[13px] text-muted">{courses.length} {courses.length === 1 ? 'course' : 'courses'}</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((c) => {
              const { done, total } = progressOf(c);
              const finished = total > 0 && done === total;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpenId(c.id)} className="group flex h-full w-full flex-col overflow-hidden rounded-[10px] border border-line bg-surface text-left transition-colors hover:border-line-strong">
                    <span className="flex h-28 flex-col justify-between p-4 text-white" style={cover(c.id)}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-medium text-white/80">{c.units.length} {c.units.length === 1 ? 'unit' : 'units'}, {total} {total === 1 ? 'lesson' : 'lessons'}</span>
                        {finished && <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[12px] font-semibold"><Icon name="check" className="size-3.5" /> Done</span>}
                      </span>
                      <span className="flex flex-wrap gap-1.5" aria-hidden>
                        {lessonsOf(c).map((l) => <span key={l.id} className={cn('h-2 w-5 rounded-full', l.done ? 'bg-white' : 'bg-white/25')} />)}
                      </span>
                    </span>
                    <span className="flex flex-1 flex-col p-4">
                      <strong className="line-clamp-2 text-[16px] leading-6 font-semibold">{c.title}</strong>
                      <span className="mt-auto flex items-center gap-3 pt-4">
                        <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent-fill transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
                        <span className="tnum text-[12px] text-muted">{finished ? 'Complete' : done ? `${done}/${total}` : 'Not started'}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {courses.length === 0 && !busy && (
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ['Pick any topic', 'A class, a chapter, or something you are curious about.'],
            ['Learn in order', 'Units go from the basics to the harder ideas, one short lesson at a time.'],
            ['Check yourself', 'Three quick questions after each lesson, and points when you finish.'],
          ].map(([t, d]) => (
            <div key={t} className="border-l-2 border-line pl-4">
              <p className="text-[15px] font-semibold">{t}</p>
              <p className="mt-0.5 text-[14px] text-muted">{d}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
