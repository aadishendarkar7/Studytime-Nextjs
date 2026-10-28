import { connection } from 'next/server';
import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createPost, listFeed } from '@/lib/server/services/feed';

const text = (n: number) => z.string().trim().max(n);
const postSchema = z.object({
  minutes: z.coerce.number().int().min(5, 'Post sessions of 5 minutes or more').max(720),
  subject: text(60),
  topics: z.array(text(50)).max(8).default([]).transform((l) => l.filter(Boolean)),
  place: text(80),
  with: z.array(text(40)).max(10).transform((l) => l.filter(Boolean)),
  note: text(280),
  visibility: z.enum(['followers', 'school', 'everyone']),
  at: z.number().optional(),
});

export const GET = handle(async (request: Request) => {
  await connection();
  const me = await requireAccount(request);
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const before = Number(url.searchParams.get('before')) || Infinity;
  return json({ posts: await listFeed(me, scope === 'school' || scope === 'mine' ? scope : 'following', before) });
});

export const POST = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await rateLimit('post', me.id, 30, 3600, 'Too many posts. Try again later.');
  return json({ post: await createPost(me, await readJson(request, postSchema)) }, 201);
});
