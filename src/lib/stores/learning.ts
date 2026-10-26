'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STARTER_DECKS } from '@/features/games/decks';
import { schedule, type Rating } from '@/features/games/srs';
import type { StudySet } from '@/lib/types';
import { uid } from '@/lib/utils';

export const LEARNING_KEY = 'studytime:learning';
export const DEFAULT_FOLDER = 'My sets';

export interface LearningData {
  sets: StudySet[];
  selectedId: string;
  folders: string[];
  folderFilter: string;
  best: Record<string, number>;
  classSession: { code: string; token: string } | null;
  classStudentName: string;
}

const starterSet = (): StudySet => ({ id: 'starter', name: 'Study Skills', folder: DEFAULT_FOLDER, sourceDeck: STARTER_DECKS[0].id, cards: STARTER_DECKS[0].cards.map((c) => ({ ...c, id: uid() })) });
export const defaultLearning = (): LearningData => ({ sets: [starterSet()], selectedId: 'starter', folders: [], folderFilter: 'all', best: {}, classSession: null, classStudentName: '' });

interface LearningActions {
  update: (patch: Partial<LearningData>) => void;
  addSet: (name: string, cards: { front: string; back: string }[], folder?: string, sourceDeck?: string) => StudySet;
  updateSet: (id: string, patch: Partial<Omit<StudySet, 'id'>>) => void;
  deleteSet: (id: string) => void;
  addCards: (setId: string, cards: { front: string; back: string }[]) => void;
  removeCard: (setId: string, cardId: string) => void;
  rateCard: (setId: string, cardId: string, rating: Rating) => void;
  addFolder: (name: string) => void;
  recordBest: (setId: string, score: number) => boolean;
}

export type LearningStore = LearningData & LearningActions;

const clean = (cards: { front: string; back: string }[]) =>
  cards.map((c) => ({ id: uid(), front: String(c.front).trim().slice(0, 180), back: String(c.back).trim().slice(0, 180) })).filter((c) => c.front && c.back);

export const useLearning = create<LearningStore>()(
  persist(
    (set, get) => ({
      ...defaultLearning(),
      update: (patch) => set(patch),
      addSet: (name, cards, folder, sourceDeck) => {
        const s: StudySet = { id: uid(), name: name.trim().slice(0, 60) || 'New set', folder: (folder || DEFAULT_FOLDER).trim().slice(0, 40) || DEFAULT_FOLDER, cards: clean(cards), ...(sourceDeck ? { sourceDeck } : {}) };
        set({ sets: [...get().sets, s], selectedId: s.id, folderFilter: 'all' });
        return s;
      },
      updateSet: (id, patch) => set({ sets: get().sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
      deleteSet: (id) => {
        let sets = get().sets.filter((s) => s.id !== id);
        if (!sets.length) sets = [starterSet()];
        set({ sets, selectedId: sets[0].id });
      },
      addCards: (setId, cards) => set({ sets: get().sets.map((s) => (s.id === setId ? { ...s, cards: [...s.cards, ...clean(cards)] } : s)) }),
      removeCard: (setId, cardId) => set({ sets: get().sets.map((s) => (s.id === setId ? { ...s, cards: s.cards.filter((c) => c.id !== cardId) } : s)) }),
      rateCard: (setId, cardId, rating) =>
        set({ sets: get().sets.map((s) => (s.id === setId ? { ...s, cards: s.cards.map((c) => (c.id === cardId ? { ...c, srs: schedule(c.srs, rating) } : c)) } : s)) }),
      addFolder: (name) => {
        const f = name.trim().slice(0, 40);
        if (f && !get().folders.includes(f)) set({ folders: [...get().folders, f] });
      },
      recordBest: (setId, score) => {
        if (score <= (get().best[setId] ?? 0)) return false;
        set({ best: { ...get().best, [setId]: score } });
        return true;
      },
    }),
    {
      name: LEARNING_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ sets: s.sets, selectedId: s.selectedId, folders: s.folders, folderFilter: s.folderFilter, best: s.best, classSession: s.classSession, classStudentName: s.classStudentName }),
      merge: (persisted, current) => {
        const p = { ...current, ...(persisted as Partial<LearningData>) };
        if (!Array.isArray(p.sets) || !p.sets.length) p.sets = [starterSet()];
        p.sets = p.sets.map((s) => ({ ...s, folder: s.folder || DEFAULT_FOLDER, cards: (s.cards || []).map((c) => ({ ...c, id: c.id || uid() })) }));
        if (!p.sets.some((s) => s.id === p.selectedId)) p.selectedId = p.sets[0].id;
        if (!Array.isArray(p.folders)) p.folders = [];
        if (!p.best || typeof p.best !== 'object') p.best = {};
        return p as LearningStore;
      },
    },
  ),
);

export const allFolders = (s: Pick<LearningData, 'folders' | 'sets'>) => [...new Set([DEFAULT_FOLDER, ...s.folders, ...s.sets.map((x) => x.folder)])];
