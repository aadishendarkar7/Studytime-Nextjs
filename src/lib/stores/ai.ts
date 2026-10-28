'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isProviderId, PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import { uid } from '@/lib/utils';

export const AI_KEY = 'studytime:ai';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; files?: string[]; /** Tutor action used, like a cheat sheet or summary. */ action?: string }
export interface Chat { id: string; title: string; mode: 'tutor' | 'support'; messages: ChatMessage[]; updatedAt: number }
export interface Concept { id: string; name: string; subject: string; summary: string; example: string; mastery: number; seen: number; source: string; createdAt: number; updatedAt: number }
export interface Note { id: string; title: string; folder: string; kind: NoteKind; content: string; createdAt: number }
export type NoteKind = 'notes' | 'cheatsheet' | 'summary' | 'quiz' | 'guide' | 'solution' | 'writing';
export interface Solve { id: string; at: number; mode: 'full' | 'hint' | 'check'; question: string; answer: string; verdict: { agree: boolean; note: string; finalAnswer: string } | null; concepts: string[] }

export interface AiSettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  crossCheck: boolean;
  accessCode: string;
  level: string;
  exam: string;
  language: string;
  subject: string;
}

export interface AiData extends AiSettings {
  chats: Chat[];
  activeChat: string;
  chatMode: Chat['mode'];
  concepts: Concept[];
  notes: Note[];
  noteFolders: string[];
  solves: Solve[];
}

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Vietnamese', 'Hindi', 'Arabic'];

export const defaultAi = (): AiData => ({
  provider: 'gemini', keys: {}, models: {}, crossCheck: true, accessCode: '', level: 'College', exam: 'None', language: 'English', subject: 'Any subject',
  chats: [], activeChat: '', chatMode: 'tutor', concepts: [], notes: [], noteFolders: ['General', 'Assignments'], solves: [],
});

interface AiActions {
  update: (patch: Partial<AiData>) => void;
  setKey: (provider: ProviderId, key: string) => void;
  setModel: (provider: ProviderId, model: string) => void;
  upsertChat: (chat: Chat) => void;
  deleteChat: (id: string) => void;
  upsertConcepts: (list: Partial<Concept>[], source: string) => number;
  updateConcept: (id: string, patch: Partial<Concept>) => void;
  deleteConcept: (id: string) => void;
  saveNote: (note: Omit<Note, 'id' | 'createdAt'>) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addNoteFolder: (name: string) => void;
  addSolve: (solve: Solve) => void;
}

export type AiStore = AiData & AiActions;

export const useAi = create<AiStore>()(
  persist(
    (set, get) => ({
      ...defaultAi(),
      update: (patch) => set(patch),
      setKey: (provider, key) => set({ keys: { ...get().keys, [provider]: key.trim() } }),
      setModel: (provider, model) => set({ models: { ...get().models, [provider]: model } }),
      upsertChat: (chat) => set({ chats: [chat, ...get().chats.filter((c) => c.id !== chat.id)].slice(0, 50), activeChat: chat.id }),
      deleteChat: (id) => set({ chats: get().chats.filter((c) => c.id !== id), activeChat: get().activeChat === id ? '' : get().activeChat }),
      upsertConcepts: (list, source) => {
        let added = 0;
        const concepts = [...get().concepts];
        const subject = get().subject === 'Any subject' ? 'General' : get().subject;
        for (const raw of list) {
          const name = String(raw.name || '').trim().slice(0, 80);
          if (!name) continue;
          const index = concepts.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
          if (index >= 0) {
            concepts[index] = { ...concepts[index], seen: concepts[index].seen + 1, updatedAt: Date.now() };
            continue;
          }
          concepts.unshift({ id: uid(), name, subject: String(raw.subject || subject).slice(0, 40), summary: String(raw.summary || '').slice(0, 400), example: String(raw.example || '').slice(0, 300), mastery: 20, seen: 1, source: source.slice(0, 80), createdAt: Date.now(), updatedAt: Date.now() });
          added++;
        }
        set({ concepts: concepts.slice(0, 400) });
        return added;
      },
      updateConcept: (id, patch) => set({ concepts: get().concepts.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)) }),
      deleteConcept: (id) => set({ concepts: get().concepts.filter((c) => c.id !== id) }),
      saveNote: (n) => {
        const note: Note = { ...n, title: n.title.slice(0, 80) || 'Untitled notes', folder: get().noteFolders.includes(n.folder) ? n.folder : 'General', id: uid(), createdAt: Date.now() };
        set({ notes: [note, ...get().notes].slice(0, 200) });
        return note;
      },
      updateNote: (id, patch) => set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }),
      deleteNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
      addNoteFolder: (name) => {
        const f = name.trim().slice(0, 40);
        if (f && !get().noteFolders.includes(f)) set({ noteFolders: [...get().noteFolders, f] });
      },
      addSolve: (solve) => set({ solves: [solve, ...get().solves.filter((s) => s.id !== solve.id)].slice(0, 40) }),
    }),
    {
      name: AI_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const out: Partial<AiData> = {};
        for (const k of Object.keys(defaultAi()) as (keyof AiData)[]) (out as Record<string, unknown>)[k] = s[k];
        return out;
      },
      merge: (persisted, current) => {
        const p = { ...current, ...(persisted as Partial<AiData>) };
        for (const k of ['chats', 'concepts', 'notes', 'noteFolders', 'solves'] as const) if (!Array.isArray(p[k])) (p as AiData)[k] = defaultAi()[k] as never;
        if (!isProviderId(p.provider)) p.provider = 'gemini';
        if (!p.keys || typeof p.keys !== 'object') p.keys = {};
        if (!p.models || typeof p.models !== 'object') p.models = {};
        if (!p.noteFolders.includes('General')) p.noteFolders.unshift('General');
        return p as AiStore;
      },
    },
  ),
);

export const modelFor = (s: Pick<AiSettings, 'provider' | 'models'>, tier: 'main' | 'fast' | 'verify' = 'main') => {
  const info = PROVIDERS[s.provider];
  const chosen = s.models[s.provider];
  if (tier === 'main') return chosen || info.defaults.main;
  // If the student picked a custom model that isn't in our catalog, reuse it everywhere.
  if (chosen && !info.models.some((m) => m.id === chosen)) return chosen;
  return info.defaults[tier];
};
