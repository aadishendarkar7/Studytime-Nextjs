import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { deleteFeed, saveFeed } from '@/lib/server/services/calendar';

const event = z.object({
  uid: z.string().max(80),
  title: z.string().transform((v) => v.slice(0, 200)),
  start: z.number(),
  end: z.number(),
  allDay: z.boolean(),
  description: z.string().optional().transform((v) => (v || '').slice(0, 500)),
});

/** Creates or updates the student's Studytime subscribe link with their plan. */
export const PUT = handle(async (request: Request) => {
  await rateLimit('calendar-feed', clientIp(request), 120, 3600, 'Too many calendar updates. Try again later.');
  const body = await readJson(request, z.object({ token: z.string().max(64).nullable(), events: z.array(event).max(600) }), 300_000);
  return json(await saveFeed(body.token, body.events));
});

export const DELETE = handle(async (request: Request) => {
  const { token } = await readJson(request, z.object({ token: z.string().max(64) }));
  await deleteFeed(token);
  return json({ ok: true });
});
