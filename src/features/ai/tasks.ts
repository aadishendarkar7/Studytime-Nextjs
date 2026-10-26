'use client';
import { callJSON } from '@/lib/ai/client';
import { toParts, type Attachment } from '@/lib/ai/files';
import { conceptSystem, flashcardSystem, quizSystem, VERIFY_SYSTEM } from '@/lib/ai/prompts';
import { useAi, type Concept } from '@/lib/stores/ai';

const profile = () => useAi.getState();

export async function generateCards(material: string, count = 15, files: Attachment[] = []) {
  const result = await callJSON<{ cards?: { front: string; back: string }[] } | { front: string; back: string }[]>({
    tier: 'main',
    maxTokens: 4000,
    system: flashcardSystem(profile()),
    messages: [{ role: 'user', content: [...toParts(files), { type: 'text', text: `Make ${count} flashcards covering the most important, testable ideas in this material:\n\n${material || '(see the attached files)'}` }] }],
  });
  const cards = (Array.isArray(result) ? result : result.cards ?? []).filter((c) => c?.front && c?.back).slice(0, 60);
  if (!cards.length) throw new Error('No flashcards were created. Try again with more material.');
  return cards;
}

export async function extractConcepts(question: string, answer: string) {
  const result = await callJSON<{ concepts?: Partial<Concept>[] }>({
    tier: 'fast',
    maxTokens: 900,
    system: conceptSystem(profile()),
    messages: [{ role: 'user', content: `Problem: ${question}\n\nSolution:\n${answer.slice(0, 6000)}` }],
  });
  return (result.concepts ?? []).filter((c) => c?.name).slice(0, 4);
}

export async function crossCheck(question: string, answer: string, files: Attachment[]) {
  const v = await callJSON<{ agree?: boolean; final_answer?: string; note?: string }>({
    tier: 'verify',
    maxTokens: 1500,
    system: VERIFY_SYSTEM,
    messages: [{ role: 'user', content: [...toParts(files), { type: 'text', text: `Problem: ${question || '(see image)'}\n\nProposed solution:\n${answer}` }] }],
  });
  return { agree: Boolean(v.agree), note: String(v.note ?? ''), finalAnswer: String(v.final_answer ?? '') };
}

export interface QuizQuestion { q: string; options: string[]; answer: number; why?: string }
export async function conceptQuiz(c: Concept) {
  const r = await callJSON<{ questions?: QuizQuestion[] }>({
    tier: 'fast',
    maxTokens: 1500,
    system: quizSystem(profile()),
    messages: [{ role: 'user', content: `Concept: ${c.name} (${c.subject}). ${c.summary}\nWrite 3 questions, increasing difficulty.` }],
  });
  const qs = (r.questions ?? []).filter((q) => Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(Number(q.answer))).slice(0, 5);
  if (!qs.length) throw new Error('Could not create questions. Try again.');
  return qs.map((q) => ({ ...q, answer: Number(q.answer) }));
}

export async function describeConcept(name: string) {
  const s = profile();
  return callJSON<Partial<Concept>>({
    tier: 'fast',
    maxTokens: 400,
    system: `Return only JSON {"name","subject","summary","example"} describing this academic concept for a ${s.level} student. summary is one plain sentence. Write in ${s.language}.`,
    messages: [{ role: 'user', content: name }],
  });
}
