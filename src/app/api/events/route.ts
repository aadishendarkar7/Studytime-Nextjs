import { type NextRequest } from 'next/server';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createEvent, listEvents } from '@/lib/server/services/events';
import { eventSchema } from '@/lib/server/validation';

export const GET = handle(async (request: NextRequest) => {
  await rateLimit('events-list', clientIp(request), 120, 60, 'Too many refreshes. Wait a minute.');
  return json({ events: await listEvents((request.nextUrl.searchParams.get('school') || '').slice(0, 80)) });
});

export const POST = handle(async (request: Request) => {
  await rateLimit('events-create', clientIp(request), 10, 3600, 'Too many events. Try again later.');
  return json(await createEvent(await readJson(request, eventSchema)), 201);
});
