'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AWARD, completeSession, isDuration, type Duration } from '@/features/focus/logic';
import type { Reflection, Reminder, ReminderType, Session, ThemeName, TimerState } from '@/lib/types';
import { uid } from '@/lib/utils';

export const PROFILE_KEY = 'studytime:profile';

export interface ProfileData {
  name: string;
  dailyGoal: number;
  weeklyGoal: number;
  points: number;
  sessions: Session[];
  bonusDays: string[];
  duration: Duration;
  subject: string;
  location: string;
  theme: ThemeName;
  accent: string;
  reminders: Reminder[];
  major: string;
  school: string;
  year: string;
  courses: string[];
  leaderboard: { token: string; id: string } | null;
  circle: { code: string; memberId: string; publicId: string } | null;
  rewardGoalId: string;
  nextPlanAt: number | null;
  nextPlanNotified: boolean;
  reflections: Reflection[];
  timer: TimerState;
}

export const defaultProfile = (): ProfileData => ({
  name: 'Student', dailyGoal: 60, weeklyGoal: 300, points: 0, sessions: [], bonusDays: [], duration: 30, subject: '', location: '',
  theme: 'light', accent: '#7eab58', reminders: [], major: '', school: '', year: '', courses: [], leaderboard: null, circle: null,
  rewardGoalId: '', nextPlanAt: null, nextPlanNotified: false, reflections: [], timer: { mode: 'ready', remaining: 30 * 60, deadline: null },
});

interface ProfileActions {
  update: (patch: Partial<ProfileData>) => void;
  setDuration: (d: Duration) => void;
  startOrPause: () => void;
  resetTimer: () => void;
  /** Pause a running timer (e.g. when the tab is hidden). */
  pauseTimer: () => void;
  /** Called every tick; returns the completed session if the timer finished. */
  tick: () => { session: Session; base: number; bonus: number } | null;
  addReminder: (r: { title: string; type: ReminderType; dueAt: number; lead: number; source?: Reminder['source'] }) => boolean;
  setReminderDone: (id: string, done: boolean) => void;
  deleteReminder: (id: string) => void;
  markNotified: (ids: string[]) => void;
  addReflection: (r: Omit<Reflection, 'at'>) => void;
  addCourse: (course: string) => void;
  removeCourse: (index: number) => void;
}

export type ProfileStore = ProfileData & ProfileActions;

export const useProfile = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...defaultProfile(),
      update: (patch) => set(patch),
      setDuration: (d) => {
        if (get().timer.mode !== 'ready') return;
        set({ duration: d, timer: { mode: 'ready', remaining: d * 60, deadline: null } });
      },
      startOrPause: () => {
        const t = get().timer;
        if (t.mode === 'running') set({ timer: { mode: 'paused', remaining: Math.max(1, Math.ceil(((t.deadline ?? 0) - Date.now()) / 1000)), deadline: null } });
        else set({ timer: { mode: 'running', remaining: t.remaining, deadline: Date.now() + t.remaining * 1000 } });
      },
      resetTimer: () => set({ timer: { mode: 'ready', remaining: get().duration * 60, deadline: null } }),
      pauseTimer: () => {
        const t = get().timer;
        if (t.mode !== 'running') return;
        set({ timer: { mode: 'paused', remaining: Math.max(1, Math.ceil(((t.deadline ?? 0) - Date.now()) / 1000)), deadline: null } });
      },
      tick: () => {
        const s = get();
        const t = s.timer;
        if (t.mode !== 'running' || !t.deadline) return null;
        if (Date.now() < t.deadline) {
          const remaining = Math.ceil((t.deadline - Date.now()) / 1000);
          if (remaining !== t.remaining) set({ timer: { ...t, remaining } });
          return null;
        }
        const result = completeSession({ sessions: s.sessions, bonusDays: s.bonusDays, dailyGoal: s.dailyGoal, duration: s.duration, subject: s.subject, location: s.location });
        set({
          sessions: [result.session, ...s.sessions].slice(0, 2000),
          points: s.points + result.base + result.bonus,
          bonusDays: result.bonusDay ? [...s.bonusDays, result.bonusDay] : s.bonusDays,
          timer: { mode: 'ready', remaining: s.duration * 60, deadline: null },
        });
        return result;
      },
      addReminder: (r) => {
        const exists = get().reminders.some((x) => x.title === r.title && x.dueAt === r.dueAt);
        if (exists) return false;
        set({ reminders: [...get().reminders, { id: uid(), done: false, notifiedAt: null, source: 'manual', ...r }] });
        return true;
      },
      setReminderDone: (id, done) => set({ reminders: get().reminders.map((r) => (r.id === id ? { ...r, done, notifiedAt: done ? r.notifiedAt : null } : r)) }),
      deleteReminder: (id) => set({ reminders: get().reminders.filter((r) => r.id !== id) }),
      markNotified: (ids) => set({ reminders: get().reminders.map((r) => (ids.includes(r.id) ? { ...r, notifiedAt: new Date().toISOString() } : r)) }),
      addReflection: (r) => set({ reflections: [{ ...r, at: new Date().toISOString() }, ...get().reflections].slice(0, 100) }),
      addCourse: (course) => {
        const c = course.trim().slice(0, 60);
        if (!c || get().courses.some((x) => x.toLowerCase() === c.toLowerCase())) return;
        set({ courses: [...get().courses, c] });
      },
      removeCourse: (index) => set({ courses: get().courses.filter((_, i) => i !== index) }),
    }),
    {
      name: PROFILE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { update, setDuration, startOrPause, resetTimer, pauseTimer, tick, addReminder, setReminderDone, deleteReminder, markNotified, addReflection, addCourse, removeCourse, ...data } = s;
        void [update, setDuration, startOrPause, resetTimer, pauseTimer, tick, addReminder, setReminderDone, deleteReminder, markNotified, addReflection, addCourse, removeCourse];
        return data;
      },
      merge: (persisted, current) => sanitizeProfile({ ...current, ...(persisted as Partial<ProfileData>) }) as ProfileStore,
    },
  ),
);

/** Repair stored data from older versions or manual edits. */
export function sanitizeProfile<T extends ProfileData>(p: T): T {
  const base = defaultProfile();
  const out = { ...p };
  for (const key of ['sessions', 'bonusDays', 'reminders', 'courses', 'reflections'] as const) if (!Array.isArray(out[key])) (out as ProfileData)[key] = base[key] as never;
  if (out.theme !== 'light' && out.theme !== 'dark') out.theme = 'light';
  if (!/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = base.accent;
  if (!isDuration(out.duration)) out.duration = 30;
  if (!out.timer || !['ready', 'running', 'paused'].includes(out.timer.mode)) out.timer = { mode: 'ready', remaining: out.duration * 60, deadline: null };
  // A timer that was running when the page closed resumes as paused.
  if (out.timer.mode === 'running') out.timer = { mode: 'paused', remaining: Math.max(1, Math.ceil(((out.timer.deadline ?? 0) - Date.now()) / 1000)), deadline: null };
  if (!Number.isFinite(out.points)) out.points = 0;
  return out;
}

export const pointsFor = (d: Duration) => AWARD[d];
