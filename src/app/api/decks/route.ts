import { connection } from 'next/server';
import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { listDecks, shareDeck } from '@/lib/server/services/decks';
import { cardsSchema, nameSchema } from '@/lib/server/validation';

export const GET = handle(async () => {
  await connection();
  return json({ decks: await listDecks() });
});

export const POST = handle(async (request: Request) => {
  await rateLimit('deck-share', clientIp(request), 20, 3600, 'Too many decks shared. Try again later.');
  const body = await readJson(
    request,
    z.object({ name: z.string().transform((v) => v.trim().slice(0, 60) || 'Shared deck'), subject: z.string().optional().transform((v) => (v || '').trim().slice(0, 40)), author: nameSchema, cards: cardsSchema }),
    150_000,
  );
  return json(await shareDeck(body), 201);
});
