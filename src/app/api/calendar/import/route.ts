import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { importCalendar } from '@/lib/server/services/calendar';

/** Fetches a calendar link and returns its events. The link itself is not stored on the server. */
export const POST = handle(async (request: Request) => {
  await rateLimit('calendar-import', clientIp(request), 60, 3600, 'Too many calendar refreshes. Try again in a while.');
  const { url } = await readJson(request, z.object({ url: z.string().min(8).max(2000) }));
  return json(await importCalendar(url));
});
