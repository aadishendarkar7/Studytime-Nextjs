import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createClass } from '@/lib/server/services/classes';
import { cardsSchema, nameSchema } from '@/lib/server/validation';

const text = (fallback: string) => z.string().optional().transform((v) => (v || '').trim().slice(0, 60) || fallback);

export const POST = handle(async (request: Request) => {
  await rateLimit('class-create', clientIp(request), 30, 3600, 'Too many classes created. Try again later.');
  const body = await readJson(request, z.object({ name: text('Study class'), setName: text('Class set'), student: nameSchema, cards: cardsSchema }), 150_000);
  return json(await createClass(body), 201);
});
