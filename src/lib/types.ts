// Shared domain types used by the client stores, API routes, and UI.

export type ThemeName = 'light' | 'dark' | 'system';
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
  source?: 'syllabus' | 'manual' | 'calendar';
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
  drops?: number;
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

// ---------- Study partners ----------
export type PartnerFormat = 'in-person' | 'online' | 'either';
export interface PartnerInput {
  name: string;
  school: string;
  major: string;
  year: string;
  courses: string[];
  format: PartnerFormat;
  availability: string;
  contact: string;
  note: string;
}
export interface PartnerListing extends PartnerInput { id: string; updatedAt: number }

// ---------- Study spots ----------
export const SPOT_TAGS = ['Quiet', 'Group friendly', 'Outlets', 'Wi-Fi', 'Open late', 'Food nearby', 'Outdoor'] as const;
export interface SpotInput { name: string; lat: number; lng: number; note: string; tags: string[]; school: string }
export interface PublicSpot extends SpotInput { id: string; createdAt: number }

// ---------- Drop a Spot ----------
export type DropAudience = 'circle' | 'school' | 'everyone';
/** How the table works: heads down, quiet talking is fine, or working through problems together. */
export type DropVibe = 'silent' | 'quiet' | 'group';
export interface DropInput {
  name: string;
  spotName: string;
  lat: number | null;
  lng: number | null;
  subject: string;
  note: string;
  startsAt: number;
  endsAt: number;
  audience: DropAudience;
  school: string;
  vibe: DropVibe;
  /** Open seats at the table, or null for no limit. */
  seats: number | null;
  /** What kind of studying, so people can find their crowd. */
  category?: string;
}
export interface DropJoiner { id: string; name: string; at: number; status: 'coming' | 'here' }
export interface DropMessage { id: string; name: string; text: string; at: number; host: boolean }
export interface DropView extends DropInput {
  id: string;
  createdAt: number;
  joiners: DropJoiner[];
  messages: DropMessage[];
  /** Made by someone you follow. */
  friend?: boolean;
}

// ---------- Chat ----------
export type ChatStatus = 'focusing' | 'drop' | 'online';
/** What other students can see about you in chat. */
export interface ChatPerson { id: string; name: string; school: string; major: string; year: string; courses: string[]; status: ChatStatus; statusText: string; lastSeen: number; prompts?: { q: string; a: string }[]; style?: string }
export interface ChatMessage { id: string; channel: string; from: string; name: string; text: string; at: number }
export interface ChatThread { with: string; name: string; last: number; preview: string; fromMe: boolean }
export interface ChatChannelInfo { at: number; name: string; preview: string }

// ---------- Focus Buddy ----------
export interface BuddyView { id: string; name: string; course: string; task: string; startedAt: number; endsAt: number; status: 'focusing' | 'done' | 'left'; lastSeen: number }

// ---------- Weekly pact ----------
export interface PactView { code: string; goal: number; week: string; members: { id: string; name: string; minutes: number; updatedAt: number }[] }

// ---------- Campus study events ----------
export const CATEGORIES = ['Math & stats', 'Sciences', 'Pre-med & health', 'Coding', 'Engineering', 'Business', 'Writing & humanities', 'Languages', 'Arts & design', 'Exam prep', 'Student athletes', 'Anything goes'] as const;
export interface EventInput { host: string; title: string; course: string; category: string; place: string; startsAt: number; endsAt: number; capacity: number | null; school: string; audience: 'school' | 'everyone'; note: string }
export interface EventView extends EventInput { id: string; createdAt: number; going: { id: string; name: string }[] }

/** Study highlights: a recap of a session, shared with friends. */
export type PostVisibility = 'followers' | 'school' | 'everyone';
export interface FeedPost {
  id: string;
  userId: string;
  name: string;
  school: string;
  major: string;
  minutes: number;
  subject: string;
  topics: string[];
  place: string;
  with: string[];
  note: string;
  at: number;
  visibility: PostVisibility;
  kudos: string[];
  kudosNames: string[];
  /** Friends tagged as studying together. The post shows for them and their followers too. */
  crew?: { id: string; name: string }[];
  /** Has a photo, served from /api/feed/<id>/photo. */
  photo?: boolean;
}
export interface PersonView { id: string; name: string; school: string; major: string; year: string; following: boolean; followsYou: boolean; followers: number; weekMinutes: number; posts: number }
