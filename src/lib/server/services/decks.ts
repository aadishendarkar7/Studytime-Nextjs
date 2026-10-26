import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';
import { secret } from '../ids';
import type { Deck } from '@/lib/types';

const KEY = 'decks';
const MAX_DECKS = 500;

export async function listDecks(): Promise<Deck[]> {
  const all = await getStorage().hgetall<Deck>(KEY);
  return Object.values(all).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function shareDeck(input: Omit<Deck, 'id' | 'createdAt'>) {
  if (input.cards.length < 2) throw new HttpError(400, 'Share a deck with at least two cards');
  const s = getStorage();
  if ((await s.hlen(KEY)) >= MAX_DECKS) {
    const oldest = (await listDecks()).at(-1);
    if (oldest) await s.hdel(KEY, oldest.id);
  }
  const deck: Deck = { ...input, id: secret(6), createdAt: Date.now() };
  await s.hset(KEY, deck.id, deck);
  return { id: deck.id };
}
