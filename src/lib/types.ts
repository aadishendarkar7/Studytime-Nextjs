// Shared domain types used by the client stores, API routes, and UI.

export type ThemeName = 'light' | 'dark';
export type ReminderType = 'homework' | 'exam' | 'assignment';

export interface Session {
  id: string;
  at: string; // ISO timestamp
  day: string; // YYYY-MM-DD local date key
  minutes: number;
  points: number;
  subject: string;
  location: string;
}

export interface Reminder {
  id: string;
  title: string;
  type: ReminderType;
  dueAt: number;
  lead: number; // minutes before dueAt to alert
  done: boolean;
  notifiedAt: string | null;
  source?: 'syllabus' | 'manual';
}

export interface Reflection {
  at: string;
  note: string;
  mood: 'good' | 'okay' | 'tired';
}

export type TimerMode = 'ready' | 'running' | 'paused';
export interface TimerState {
  mode: TimerMode;
  remaining: number; // seconds
  deadline: number | null;
}

export interface Card {
  id: string;
  front: string;
  back: string;
  srs?: SrsState;
}

export interface SrsState {
  interval: number; // days
  ease: number;
  reps: number;
  due: number; // epoch ms
}

export interface StudySet {
  id: string;
  name: string;
  folder: string;
  cards: Card[];
  sourceDeck?: string;
}

export interface Deck {
  id: string;
  name: string;
  subject: string;
  author?: string;
  cards: { front: string; back: string }[];
  createdAt?: number;
}

// ---------- Shared server API shapes ----------
export interface CircleMemberView {
  id: string;
  name: string;
  minutes: number;
  streak: number;
}

export interface ClassRoundView {
  status: 'question' | 'reveal';
  index: number;
  total: number;
  question: string;
  options: string[];
  correct: string | null;
  answers: number;
  yourAnswer: string | null;
}

export interface ClassView {
  code: string;
  name: string;
  setName: string;
  cards: { front: string; back: string }[];
  members: { name: string; score: number; minutes: number; isHost: boolean }[];
  round: ClassRoundView | null;
  finished: boolean;
  isHost: boolean;
}

export type LeaderScope = 'school' | 'major' | 'year' | 'class';
export interface LeaderboardEntry {
  id: string;
  name: string;
  minutes: number;
  quizScore?: number;
  major?: string;
  year?: string;
}
export interface LeaderboardResult {
  scope: LeaderScope;
  label: string;
  entries: LeaderboardEntry[];
  message?: string;
}
