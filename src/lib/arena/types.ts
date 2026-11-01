/** Arena types shared by the server and the browser. No answers live here. */
export type ArenaMode = 'daily' | 'quick' | 'duel' | 'accept';
export type Topic = 'mixed' | 'math' | 'science' | 'general';
export const TOPICS: { id: Topic; label: string }[] = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'math', label: 'Math and stats' },
  { id: 'science', label: 'Science and CS' },
  { id: 'general', label: 'Econ, history, words' },
];

export const TIERS = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 1100 },
  { name: 'Gold', min: 1200 },
  { name: 'Platinum', min: 1350 },
  { name: 'Diamond', min: 1500 },
] as const;
export const TIER_COLOR: Record<string, string> = { Bronze: '#9a5b2e', Silver: '#6b7280', Gold: '#a87a12', Platinum: '#2f7a8a', Diamond: '#4a56c8' };

export function tierOf(rating: number) {
  let i = 0;
  while (i < TIERS.length - 1 && rating >= TIERS[i + 1].min) i++;
  const next = TIERS[i + 1];
  return { name: TIERS[i].name as string, next: next ? { name: next.name as string, at: next.min } : null };
}

export interface ArenaQuestion { index: number; prompt: string; choices: string[]; seconds: number; startsIn: number; topic: string }
export interface ArenaResult {
  score: number;
  correct: number;
  total: number;
  outcome: 'win' | 'loss' | 'tie' | 'pending' | null;
  opponentScore: number | null;
  ratingBefore: number;
  ratingAfter: number;
  pointsEarned: number;
  dailyRank: number | null;
  dailyPlayers: number | null;
  streak: number | null;
}
export interface ArenaRunView {
  id: string;
  mode: ArenaMode;
  topic: Topic;
  total: number;
  index: number;
  score: number;
  answers: { ok: boolean; pts: number }[];
  question: ArenaQuestion | null;
  opponent: { name: string; rating: number; tier: string; kind: 'ghost' | 'duel' | 'bot'; timeline?: { ok: boolean; ms: number; pts: number }[] } | null;
  result: ArenaResult | null;
}
export interface ArenaDuelView { id: string; topic: Topic; createdAt: number; status: 'waiting' | 'done' | 'declined'; them: string; myScore: number | null; theirScore: number | null; won: boolean | null }
export interface ArenaHome {
  me: { rating: number; tier: string; next: { name: string; at: number } | null; games: number; wins: number; best: number; weekPoints: number; streak: number; rank: number | null; players: number };
  daily: { date: string; played: boolean; inProgress: boolean; score: number | null; rank: number | null; players: number; top: { id: string; name: string; score: number; rank: number; me: boolean }[] };
  inbox: ArenaDuelView[];
  sent: ArenaDuelView[];
  results: ArenaDuelView[];
  friends: { id: string; name: string; rating: number; tier: string }[];
}
export interface ArenaBoardEntry { id: string; name: string; school: string; rating: number; tier: string; games: number; wins: number; weekPoints: number; me: boolean; rank: number }
export interface ArenaAnswer { ok: boolean; answer: number; pts: number; score: number; run: ArenaRunView }
