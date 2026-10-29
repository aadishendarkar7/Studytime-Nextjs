import { connection } from 'next/server';
import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createPost, listFeed, MAX_PHOTO } from '@/lib/server/services/feed';

const text = (n: number) => z.string().trim().max(n);
const postSchema = z.object({
  minutes: z.coerce.number().int().min(5, 'Post sessions of 5 minutes or more').max(720),
  subject: text(60),
  topics: z.array(text(50)).max(8).default([]).transform((l) => l.filter(Boolean)),
  place: text(80).default(''),
  with: z.array(text(40)).max(10).default([]).transform((l) => l.filter(Boolean)),
  crewIds: z.array(z.string().max(40)).max(5).default([]),
  note: text(280).default(''),
  visibility: z.enum(['followers', 'school', 'everyone']),
  at: z.number().optional(),
  photo: z.string().max(MAX_PHOTO).optional(),
});

export const GET = handle(async (request: Request) => {
  await connection();
  const me = await requireAccount(request);
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const before = Number(url.searchParams.get('before')) || Infinity;
  return json({ posts: await listFeed(me, scope === 'school' || scope === 'mine' || scope === 'following' ? scope : 'foryou', before) });
});

export const POST = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await rateLimit('post', me.id, 30, 3600, 'Too many posts. Try again later.');
  return json({ post: await createPost(me, await readJson(request, postSchema, MAX_PHOTO + 20_000)) }, 201);
});
