'use client';
import { callAI, callJSON } from '@/lib/ai/client';
import { FORMAT } from '@/lib/ai/prompts';
import { parseJSONLoose, uid } from '@/lib/utils';
import { useAi } from '@/lib/stores/ai';
import type { Lesson, MiniCourse } from '@/lib/stores/extras';

const who = () => {
  const a = useAi.getState();
  return `The student is at ${a.level} level${a.exam !== 'None' ? `, preparing for ${a.exam}` : ''}. Write in ${a.language}.`;
};

/** Plans a short course: up to 3 units of up to 4 lessons. Lesson text is written later, when opened. */
export async function planCourse(topic: string): Promise<MiniCourse> {
  // One retry: a model now and then sends back JSON that will not parse.
  try {
    return await planOnce(topic);
  } catch (e) {
    if ((e as { needsSetup?: boolean }).needsSetup) throw e;
    return planOnce(topic);
  }
}

async function planOnce(topic: string): Promise<MiniCourse> {
  const r = await callJSON<{ title?: string; units?: { title?: string; lessons?: { title?: string; goal?: string }[] }[] }>({
    tier: 'main',
    maxTokens: 1500,
    system: `You design short self-paced courses. ${who()} Return only JSON: {"title":"course title","units":[{"title":"unit title","lessons":[{"title":"lesson title","goal":"one sentence: what the student can do after"}]}]}. 2 to 3 units, 2 to 4 lessons each, ordered from basics to harder ideas. Each lesson should take about 10 minutes.`,
    messages: [{ role: 'user', content: `Course topic: ${topic}` }],
  });
  const units = (r.units ?? [])
    .map((u) => ({ title: String(u.title ?? '').slice(0, 80), lessons: (u.lessons ?? []).filter((l) => l?.title).slice(0, 4).map((l): Lesson => ({ id: uid(), title: String(l.title).slice(0, 90), goal: String(l.goal ?? '').slice(0, 200), body: '', quiz: [], done: false, score: null })) }))
    .filter((u) => u.title && u.lessons.length)
    .slice(0, 3);
  if (!units.length) throw new Error('Could not plan that course. Try a more specific topic.');
  return { id: uid(), topic, title: String(r.title || topic).slice(0, 80), level: useAi.getState().level, createdAt: Date.now(), units };
}

const QUIZ_MARK = '@@QUIZ@@';

/**
 * Writes one lesson and a three-question check. The lesson comes back as plain
 * Markdown, not inside JSON, so its math survives; only the short quiz is JSON.
 */
export async function writeLesson(course: MiniCourse, lesson: Lesson) {
  const outline = course.units.map((u) => `${u.title}: ${u.lessons.map((l) => l.title).join('; ')}`).join('\n');
  const text = await callAI({
    tier: 'main',
    maxTokens: 3500,
    system: `You teach one lesson of a short course. ${who()} First write the lesson in Markdown, 300 to 500 words: a plain explanation, one worked example, and a "## Remember" list of 3 bullets. ${FORMAT} Then write a line containing only ${QUIZ_MARK}, then a JSON array of exactly 3 multiple-choice questions that check the lesson goal: [{"q":"question","options":["A","B","C","D"],"answer":0,"why":"one sentence"}]. answer is the 0-based index. In the JSON, write math as plain text, not LaTeX.`,
    messages: [{ role: 'user', content: `Course: ${course.title}\nOutline:\n${outline}\n\nWrite the lesson "${lesson.title}". Goal: ${lesson.goal}` }],
  });
  const cut = text.indexOf(QUIZ_MARK);
  const body = (cut >= 0 ? text.slice(0, cut) : text).trim();
  let quiz: { q: string; options: string[]; answer: number; why?: string }[] = [];
  if (cut >= 0) {
    try {
      const raw = parseJSONLoose<unknown>(text.slice(cut + QUIZ_MARK.length));
      const list = (Array.isArray(raw) ? raw : (raw as { quiz?: unknown[] }).quiz ?? []) as { q: string; options: string[]; answer: number; why?: string }[];
      quiz = list.filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2).slice(0, 3).map((q) => ({ ...q, answer: Math.max(0, Math.min(q.options.length - 1, Number(q.answer) || 0)) }));
    } catch {
      quiz = []; // the lesson still works without its check
    }
  }
  if (body.length < 80) throw new Error('Could not write this lesson. Try again.');
  return { body, quiz };
}

export const lessonsOf = (c: MiniCourse) => c.units.flatMap((u) => u.lessons);
export const progressOf = (c: MiniCourse) => {
  const all = lessonsOf(c);
  return { done: all.filter((l) => l.done).length, total: all.length };
};
