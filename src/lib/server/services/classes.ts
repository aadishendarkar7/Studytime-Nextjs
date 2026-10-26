import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { code as makeCode, publicId, randomInt, secret } from '../ids';
import type { ClassView } from '@/lib/types';

const TTL = 60 * 60 * 24 * 2; // class rooms expire 2 days after last activity
const MAX_MEMBERS = 60;

interface Room {
  code: string;
  name: string;
  setName: string;
  cards: { front: string; back: string }[];
  hostToken: string;
  round: { index: number; status: 'question' | 'reveal'; options: string[] } | null;
  finished: boolean;
  createdAt: number;
}
interface Member { name: string; minutes: number; joinedAt: number }
interface Answer { choice: string; correct: boolean }

const roomKey = (c: string) => `class:${c}`;
const membersKey = (c: string) => `class:${c}:m`;
const scoresKey = (c: string) => `class:${c}:score`;
const answersKey = (c: string, i: number) => `class:${c}:a:${i}`;

function shuffle<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function touch(room: Room) {
  const s = getStorage();
  await s.set(roomKey(room.code), room, TTL);
  await Promise.all([s.expire(membersKey(room.code), TTL), s.expire(scoresKey(room.code), TTL)]);
}

async function loadRoom(c: string) {
  const room = await getStorage().get<Room>(roomKey(c));
  if (!room) throw new HttpError(404, 'Class session not found. Join again with the code.');
  return room;
}

export async function authorize(c: string, token: string | null) {
  const room = await loadRoom(c);
  const member = token ? await getStorage().hget<Member>(membersKey(c), token) : null;
  if (!member || !token) throw new HttpError(404, 'Class session not found. Join again with the code.');
  return { room, token, member };
}

export async function createClass(input: { name: string; setName: string; student: string; cards: Room['cards'] }) {
  if (new Set(input.cards.map((c) => c.back)).size < 2) throw new HttpError(400, 'Add at least two cards with different answers before hosting');
  const s = getStorage();
  let c: string;
  do c = makeCode(6);
  while (await s.get(roomKey(c)));
  const token = secret();
  const room: Room = { code: c, name: input.name, setName: input.setName, cards: input.cards, hostToken: token, round: null, finished: false, createdAt: Date.now() };
  await s.hset<Member>(membersKey(c), token, { name: input.student, minutes: 0, joinedAt: Date.now() });
  await touch(room);
  return { code: c, token };
}

export async function joinClass(c: string, name: string) {
  const room = await loadRoom(c);
  const s = getStorage();
  if ((await s.hlen(membersKey(c))) >= MAX_MEMBERS) throw new HttpError(400, 'This class is full');
  const token = secret();
  await s.hset<Member>(membersKey(c), token, { name, minutes: 0, joinedAt: Date.now() });
  await touch(room);
  return { code: c, token };
}

export async function viewClass(room: Room, token: string): Promise<ClassView> {
  const s = getStorage();
  const [members, scores] = await Promise.all([s.hgetall<Member>(membersKey(room.code)), s.hgetall<number>(scoresKey(room.code))]);
  const round = room.round;
  let answers = 0;
  let yourAnswer: string | null = null;
  if (round) {
    answers = await s.hlen(answersKey(room.code, round.index));
    yourAnswer = (await s.hget<Answer>(answersKey(room.code, round.index), token))?.choice ?? null;
  }
  return {
    code: room.code,
    name: room.name,
    setName: room.setName,
    cards: room.cards,
    members: Object.entries(members)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
      .map(([id, m]) => ({ name: m.name, score: Number(scores[id]) || 0, minutes: m.minutes || 0, isHost: id === room.hostToken })),
    round: round
      ? {
          status: round.status,
          index: round.index,
          total: room.cards.length,
          question: room.cards[round.index]?.front ?? '',
          options: round.options,
          correct: round.status === 'reveal' ? room.cards[round.index]?.back ?? null : null,
          answers,
          yourAnswer,
        }
      : null,
    finished: room.finished,
    isHost: token === room.hostToken,
  };
}

export async function advanceClass(room: Room, token: string) {
  if (token !== room.hostToken) throw new HttpError(403, 'Only the host can advance the quiz');
  if (room.finished) throw new HttpError(400, 'The quiz is finished');
  if (room.round?.status === 'question') room.round.status = 'reveal';
  else {
    const index = room.round ? room.round.index + 1 : 0;
    if (index >= room.cards.length) room.finished = true;
    else {
      const correct = room.cards[index].back;
      const others = shuffle([...new Set(room.cards.filter((_, i) => i !== index).map((x) => x.back))].filter((x) => x !== correct));
      room.round = { index, status: 'question', options: shuffle([correct, ...others.slice(0, 3)]) };
    }
  }
  await touch(room);
  return viewClass(room, token);
}

export async function answerClass(room: Room, token: string, choice: string) {
  const s = getStorage();
  if (!room.round || room.round.status !== 'question') throw new HttpError(400, 'Wait for the next question');
  if (!room.round.options.includes(choice)) throw new HttpError(400, 'Choose one of the answers');
  const key = answersKey(room.code, room.round.index);
  if (await s.hget(key, token)) throw new HttpError(400, 'You already answered this question');
  const correct = choice === room.cards[room.round.index].back;
  await s.hset<Answer>(key, token, { choice, correct });
  await s.expire(key, TTL);
  if (correct) await s.hincrby(scoresKey(room.code), token, 100);
  return viewClass(room, token);
}

export async function setClassMinutes(c: string, token: string, minutes: number) {
  const { member } = await authorize(c, token);
  await getStorage().hset<Member>(membersKey(c), token, { ...member, minutes });
}

export async function classLeaderboard(c: string, token: string) {
  const { room } = await authorize(c, token);
  const s = getStorage();
  const [members, scores] = await Promise.all([s.hgetall<Member>(membersKey(c)), s.hgetall<number>(scoresKey(c))]);
  return {
    label: room.name,
    entries: Object.entries(members)
      .map(([id, m]) => ({ id: publicId(id), name: m.name, minutes: m.minutes || 0, quizScore: Number(scores[id]) || 0 }))
      .sort((a, b) => b.minutes - a.minutes || b.quizScore - a.quizScore),
  };
}
