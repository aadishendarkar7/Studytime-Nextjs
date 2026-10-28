'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SoundId } from '@/features/sounds/engine';

export const EXTRAS_KEY = 'studytime:extras';

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

export interface CalEvent { uid: string; title: string; start: number; end: number; allDay: boolean; location: string }
export interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  kind: 'google' | 'canvas' | 'outlook' | 'apple' | 'other';
  color: string;
  /** Add all-day and due-date events from this feed to the planner as deadlines. */
  addDeadlines: boolean;
  lastSync: number | null;
  error: string;
  events: CalEvent[];
}
export interface StudyBlock {
  id: string;
  title: string;
  subject: string;
  start: number;
  end: number;
  source: 'suggested' | 'manual' | 'review' | 'step' | 'routine' | 'exam';
  reminderId?: string;
  /** Where "Start" should go, for example a flashcard set in Study games. */
  href?: string;
  done: boolean;
}
export interface PetBody { species: 'cat' | 'bunny' | 'bear' | 'pup' | 'blob'; fur: string; eyes: 'round' | 'sparkle' | 'dot'; marking: 'none' | 'spots' | 'stripe' | 'patch'; blush: boolean }
export const DEFAULT_PET: PetBody = { species: 'cat', fur: '#f2c7a3', eyes: 'round', marking: 'none', blush: true };
export interface PlanPrefs { dayStart: string; dayEnd: string; blockMinutes: number; maxPerDay: number }
export type Mood = 1 | 2 | 3 | 4 | 5;
export interface CheckIn { day: string; mood: Mood; energy: number; stress: number; sleep: number | null; note: string }
export interface ParkedThought { id: string; text: string; at: number; done: boolean }
export interface WeeklyReset { week: string; wentWell: string; gotInWay: string; change: string; intentions: string[]; at: number }
/** A drop you made, joined, or studied solo at. Kept in this browser as your drop history. */
export interface DropLogEntry {
  id: string;
  spotName: string;
  subject: string;
  vibe: 'silent' | 'quiet' | 'group';
  lat: number | null;
  lng: number | null;
  at: number;
  minutes: number;
  role: 'host' | 'joined' | 'solo';
  /** Names of the people who were there with you. */
  with: string[];
}
export interface BreakdownStep { id: string; text: string; minutes: number; done: boolean; blockId?: string }

export interface ExtrasData {
  sound: SoundId;
  volume: number;
  soundWithTimer: boolean;
  spots: StudySpot[];
  partnerListing: { id: string; token: string } | null;
  calendarFeeds: CalendarFeed[];
  studyBlocks: StudyBlock[];
  planPrefs: PlanPrefs;
  outgoingFeed: { token: string } | null;
  checkins: CheckIn[];
  water: Record<string, number>;
  waterGoal: number;
  waterRemind: boolean;
  waterEvery: number;
  waterV: number;
  lastWaterAt: number;
  parked: ParkedThought[];
  windDown: string;
  resets: WeeklyReset[];
  breakdowns: Record<string, BreakdownStep[]>;
  /** kudosSeen: newest kudos already shown, so kudos sent while the app was closed still arrive. */
  room: { code: string; memberId: string; kudosSeen?: number } | null;
  /** Drops this student made (token lets them end it) and drops they joined. */
  myDrops: { id: string; token: string; endsAt: number }[];
  joinedDrops: { dropId: string; joinerId: string; token: string; endsAt: number }[];
  dropsSeen: string[];
  /** Pause notifications about other people's drops. */
  dropQuiet: boolean;
  dropAudience: 'circle' | 'school' | 'everyone' | 'solo';
  dropVibe: 'silent' | 'quiet' | 'group';
  dropLog: DropLogEntry[];
  /** Calendars switched off in the calendar view: 'blocks', 'deadlines', or a feed id. */
  hiddenCalendars: string[];
  /** Chat identity (the token stays in this browser), what you have read, and who you blocked. */
  chat: { token: string; id: string } | null;
  chatRead: Record<string, number>;
  chatBlocked: string[];
  chatVisible: boolean;
  chatNotified: number;
  /** Focus Buddy: pair with someone focusing now. */
  buddyOptIn: boolean;
  buddy: { id: string; token: string; endsAt: number; done: boolean; awarded: boolean } | null;
  /** Weekly accountability pact with one other person. */
  pact: { code: string; memberId: string; token: string; awardedWeek: string } | null;
  myEvents: { id: string; token: string }[];
  /** Tree, pet and mystery packs. */
  packsOpened: number;
  /** Pop-up flashcard questions after sessions and now and then. */
  popQuiz: boolean;
  inventory: string[];
  petName: string;
  petWear: string;
  eventRsvps: { eventId: string; rsvpId: string; token: string }[];
  calendarView: 'day' | 'week' | 'month';
  /** Exam prep: topics and how confident you feel, keyed by exam. */
  /** How your pet looks. */
  petBody: PetBody;
  examPreps: Record<string, { topics: { id: string; name: string; conf: 'new' | 'shaky' | 'solid'; minutes: number }[]; setId?: string }>;
}

export const defaultExtras = (): ExtrasData => ({
  sound: 'rain',
  volume: 0.6,
  soundWithTimer: false,
  spots: [],
  partnerListing: null,
  calendarFeeds: [],
  studyBlocks: [],
  planPrefs: { dayStart: '09:00', dayEnd: '22:00', blockMinutes: 50, maxPerDay: 180 },
  outgoingFeed: null,
  checkins: [],
  water: {},
  waterGoal: 8,
  waterRemind: true,
  waterEvery: 30,
  waterV: 2,
  lastWaterAt: 0,
  parked: [],
  windDown: '',
  resets: [],
  breakdowns: {},
  room: null,
  myDrops: [],
  joinedDrops: [],
  dropsSeen: [],
  dropQuiet: false,
  dropAudience: 'school',
  dropVibe: 'quiet',
  dropLog: [],
  hiddenCalendars: [],
  chat: null,
  chatRead: {},
  chatBlocked: [],
  chatVisible: true,
  chatNotified: 0,
  buddyOptIn: false,
  buddy: null,
  pact: null,
  myEvents: [],
  packsOpened: 0,
  popQuiz: true,
  inventory: [],
  petName: 'Pip',
  petWear: '',
  eventRsvps: [],
  calendarView: 'week',
  examPreps: {},
  petBody: DEFAULT_PET,
});

interface ExtrasActions {
  update: (patch: Partial<ExtrasData>) => void;
}

export const useExtras = create<ExtrasData & ExtrasActions>()(
  persist(
    (set) => ({
      ...defaultExtras(),
      update: (patch) => set(patch),
    }),
    {
      name: EXTRAS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { update, ...data } = s;
        void update;
        return data;
      },
      merge: (persisted, current) => {
        const p = { ...current, ...(persisted as Partial<ExtrasData>) };
        const base = defaultExtras();
        for (const key of ['spots', 'calendarFeeds', 'studyBlocks', 'checkins', 'parked', 'resets', 'myDrops', 'joinedDrops', 'dropsSeen', 'dropLog', 'hiddenCalendars', 'chatBlocked', 'myEvents', 'eventRsvps', 'inventory'] as const) if (!Array.isArray(p[key])) (p as ExtrasData)[key] = base[key] as never;
        for (const key of ['water', 'breakdowns', 'chatRead', 'examPreps'] as const) if (!p[key] || typeof p[key] !== 'object' || Array.isArray(p[key])) (p as ExtrasData)[key] = base[key] as never;
        p.planPrefs = { ...base.planPrefs, ...(p.planPrefs || {}) };
        p.petBody = { ...base.petBody, ...(p.petBody && typeof p.petBody === 'object' ? p.petBody : {}) };
        if (!Number.isFinite(p.volume)) p.volume = base.volume;
        // Water reminders moved to every half hour by default; older saved intervals switch once.
        if (p.waterV !== base.waterV || ![25, 30, 45, 60].includes(p.waterEvery)) Object.assign(p, { waterEvery: 30, waterRemind: true, waterV: base.waterV });
        return p;
      },
    },
  ),
);
