import { NOTE_PROMPTS, SOLVE_PROMPTS, WRITE_PROMPTS } from '@/lib/ai/prompts';
import type { NoteKind } from '@/lib/stores/ai';

export interface TutorAction { id: string; label: string; prompt: string; kind: NoteKind; files?: boolean }

/**
 * What the tutor can make from a question, a photo or an uploaded file.
 * "Ask" is a normal conversation; the rest give a ready-to-save result.
 */
export const ACTIONS: TutorAction[] = [
  { id: 'answer', label: 'Answer the questions', kind: 'solution', files: true, prompt: 'Answer every question in the attached material or the message, in order. For each one use "### Question N", restate it in one line, show the working with a short reason for each step, and bold the final answer. If a question is unclear or cut off, say what you assumed.' },
  { id: 'solve', label: 'Solve step by step', kind: 'solution', prompt: SOLVE_PROMPTS.full },
  { id: 'hint', label: 'Hints only', kind: 'solution', prompt: SOLVE_PROMPTS.hint },
  { id: 'check', label: 'Check my work', kind: 'solution', prompt: SOLVE_PROMPTS.check },
  { id: 'cheatsheet', label: 'Cheat sheet', kind: 'cheatsheet', files: true, prompt: NOTE_PROMPTS.cheatsheet },
  { id: 'summary', label: 'Summarize', kind: 'summary', files: true, prompt: NOTE_PROMPTS.summary },
  { id: 'notes', label: 'Study notes', kind: 'notes', files: true, prompt: NOTE_PROMPTS.notes },
  { id: 'guide', label: 'Study guide', kind: 'guide', files: true, prompt: 'Turn this into a study guide the student can work through: "## What you need to know" (topics in order), "## Key formulas and definitions", "## Worked examples" (2 to 3), "## Likely exam questions" (5, without answers), and "## Plan" (how to split the studying over a few sessions).' },
  { id: 'practice', label: 'Practice test', kind: 'quiz', files: true, prompt: NOTE_PROMPTS.quiz },
  { id: 'terms', label: 'Key terms', kind: 'notes', files: true, prompt: 'Make a glossary of every important term in this material as a table with columns Term, Meaning (one plain sentence) and Example. Order terms the way they appear. End with "## Easy to mix up" listing pairs of terms students confuse, with the difference in one line each.' },
  { id: 'explain', label: 'Explain simply', kind: 'notes', prompt: 'Explain this as if the student is seeing it for the first time: start with the big idea in two sentences, then an everyday analogy, then the precise version with a small worked example, then "## Check yourself" with 3 quick questions and answers hidden under each as "Answer: ...".' },
  { id: 'writing', label: 'Writing feedback', kind: 'writing', files: true, prompt: WRITE_PROMPTS.feedback },
];

export const actionById = (id: string | undefined) => ACTIONS.find((a) => a.id === id);

/** Old tool links now open the tutor with the matching action picked. */
export const LEGACY_TOOL_ACTION: Record<string, string> = { solve: 'solve', assignments: 'guide', writing: 'writing' };
