'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SoundId } from '@/features/sounds/engine';
import { uid } from '@/lib/utils';

export const EXTRAS_KEY = 'studytime:extras';

/** One weighted part of a course grade, like "Exams 40%". score is a percent, or null if not graded yet. */
export interface GradeCategory { id: string; name: string; weight: number; score: number | null }
export interface GradeCourse { id: string; name: string; target: number; categories: GradeCategory[] }

export interface GpaCourse { id: string; name: string; credits: number; grade: string }
export interface GpaTerm { id: string; name: string; courses: GpaCourse[] }

export interface StudySpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
  tags: string[];
  /** Set when the spot was shared to the public map; the token lets its owner remove it. */
  shared: { id: string; token: string } | null;
}

export interface ExtrasData {
  sound: SoundId;
  volume: number;
  soundWithTimer: boolean;
  gradeCourses: GradeCourse[];
  gpaTerms: GpaTerm[];
  priorGpa: number | null;
  priorCredits: number;
  targetGpa: number | null;
  plusCountsHigher: boolean;
  spots: StudySpot[];
  partnerListing: { id: string; token: string } | null;
}

export const defaultExtras = (): ExtrasData => ({
  sound: 'rain',
  volume: 0.6,
  soundWithTimer: false,
  gradeCourses: [],
  gpaTerms: [],
  priorGpa: null,
  priorCredits: 0,
  targetGpa: null,
  plusCountsHigher: false,
  spots: [],
  partnerListing: null,
});

export const newGradeCourse = (name: string): GradeCourse => ({
  id: uid(),
  name,
  target: 90,
  categories: [
    { id: uid(), name: 'Homework', weight: 20, score: null },
    { id: uid(), name: 'Quizzes', weight: 15, score: null },
    { id: uid(), name: 'Midterms', weight: 35, score: null },
    { id: uid(), name: 'Final exam', weight: 30, score: null },
  ],
});

interface ExtrasActions {
  update: (patch: Partial<ExtrasData>) => void;
  setCourse: (id: string, fn: (c: GradeCourse) => GradeCourse) => void;
  setTerm: (id: string, fn: (t: GpaTerm) => GpaTerm) => void;
}

export const useExtras = create<ExtrasData & ExtrasActions>()(
  persist(
    (set, get) => ({
      ...defaultExtras(),
      update: (patch) => set(patch),
      setCourse: (id, fn) => set({ gradeCourses: get().gradeCourses.map((c) => (c.id === id ? fn(c) : c)) }),
      setTerm: (id, fn) => set({ gpaTerms: get().gpaTerms.map((t) => (t.id === id ? fn(t) : t)) }),
    }),
    {
      name: EXTRAS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { update, setCourse, setTerm, ...data } = s;
        void [update, setCourse, setTerm];
        return data;
      },
      merge: (persisted, current) => {
        const p = { ...current, ...(persisted as Partial<ExtrasData>) };
        const base = defaultExtras();
        for (const key of ['gradeCourses', 'gpaTerms', 'spots'] as const) if (!Array.isArray(p[key])) (p as ExtrasData)[key] = base[key] as never;
        if (!Number.isFinite(p.volume)) p.volume = base.volume;
        return p;
      },
    },
  ),
);
