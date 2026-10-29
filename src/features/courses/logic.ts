'use client';
import { callJSON } from '@/lib/ai/client';
import { useAi } from '@/lib/stores/ai';
import type { Lesson, MiniCourse } from '@/lib/stores/extras';
import { uid } from '@/lib/utils';

const who = () => {
  const a = useAi.getState();
  return `The student is at ${a.level} level${a.exam !== 'None' ? `, preparing for ${a.exam}` : ''}. Write in ${a.language}.`;
};

/** Plans a short course: up to 3 units of up to 4 lessons. Lesson text is written later, when opened. */
export async function planCourse(topic: string): Promise<MiniCourse> {
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

/** Writes one lesson and a three-question check. */
export async function writeLesson(course: MiniCourse, lesson: Lesson) {
  const outline = course.units.map((u) => `${u.title}: ${u.lessons.map((l) => l.title).join('; ')}`).join('\n');
  const r = await callJSON<{ body?: string; quiz?: { q: string; options: string[]; answer: number; why?: string }[] }>({
    tier: 'main',
    maxTokens: 3500,
    system: `You teach one lesson of a short course. ${who()} Return only JSON: {"body":"the lesson in Markdown","quiz":[{"q":"question","options":["A","B","C","D"],"answer":0,"why":"one sentence"}]}. The body is 300 to 500 words: a plain explanation, one worked example, and a "## Remember" list of 3 bullets. Use $...$ for math. The quiz has exactly 3 questions that check the lesson goal; answer is the 0-based index.`,
    messages: [{ role: 'user', content: `Course: ${course.title}\nOutline:\n${outline}\n\nWrite the lesson "${lesson.title}". Goal: ${lesson.goal}` }],
  });
  const quiz = (r.quiz ?? []).filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2).slice(0, 3).map((q) => ({ ...q, answer: Math.max(0, Math.min(q.options.length - 1, Number(q.answer) || 0)) }));
  if (!r.body) throw new Error('Could not write this lesson. Try again.');
  return { body: String(r.body), quiz };
}

export const lessonsOf = (c: MiniCourse) => c.units.flatMap((u) => u.lessons);
export const progressOf = (c: MiniCourse) => {
  const all = lessonsOf(c);
  return { done: all.filter((l) => l.done).length, total: all.length };
};
