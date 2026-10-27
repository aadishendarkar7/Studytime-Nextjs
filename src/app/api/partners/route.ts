import { type NextRequest } from 'next/server';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { createListing, searchPartners } from '@/lib/server/services/partners';
import { partnerSchema } from '@/lib/server/validation';

export const GET = handle(async (request: NextRequest) => {
  await rateLimit('partners-search', clientIp(request), 120, 60, 'Too many searches. Wait a minute.');
  const q = request.nextUrl.searchParams;
  const format = q.get('format');
  return json({
    listings: await searchPartners({
      school: (q.get('school') || '').slice(0, 80),
      course: (q.get('course') || '').slice(0, 40),
      format: format === 'in-person' || format === 'online' || format === 'either' ? format : '',
    }),
  });
});

export const POST = handle(async (request: Request) => {
  await rateLimit('partners-create', clientIp(request), 5, 3600, 'Too many listings created. Try again later.');
  const body = await readJson(request, partnerSchema);
  return json(await createListing(body), 201);
});
