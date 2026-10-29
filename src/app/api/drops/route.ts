import { type NextRequest } from 'next/server';
import { sessionUserId } from '@/lib/server/accounts';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createDrop, listDrops } from '@/lib/server/services/drops';
import { following } from '@/lib/server/services/feed';
import { dropSchema } from '@/lib/server/validation';

export const GET = handle(async (request: NextRequest) => {
  await rateLimit('drops-list', clientIp(request), 120, 60, 'Too many refreshes. Wait a minute.');
  const q = request.nextUrl.searchParams;
  const me = sessionUserId(request);
  const followed = new Set(me ? await following(me) : []);
  return json({ drops: await listDrops({ school: (q.get('school') || '').slice(0, 80), circle: (q.get('circle') || '').toUpperCase().slice(0, 8), memberId: request.headers.get('x-circle-member') || '' }, followed) });
});

export const POST = handle(async (request: Request) => {
  await rateLimit('drops-create', clientIp(request), 20, 3600, 'Too many drops. Try again later.');
  const { circle, ...input } = await readJson(request, dropSchema);
  return json(await createDrop(input, circle ?? null, sessionUserId(request)), 201);
});
