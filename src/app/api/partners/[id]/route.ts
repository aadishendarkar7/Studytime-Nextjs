import { z } from 'zod';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { deleteListing, getOwnListing, updateListing } from '@/lib/server/services/partners';
import { partnerSchema } from '@/lib/server/validation';

type Ctx = RouteContext<'/api/partners/[id]'>;
const listingId = z.string().regex(/^[a-f0-9]{12}$/, 'Listing not found');
const token = (r: Request) => r.headers.get('x-partner-token');

export const GET = handle(async (request: Request, ctx: Ctx) => json(await getOwnListing(listingId.parse((await ctx.params).id), token(request))));

export const PUT = handle(async (request: Request, ctx: Ctx) => {
  await rateLimit('partners-update', clientIp(request), 30, 3600, 'Too many updates. Try again later.');
  const id = listingId.parse((await ctx.params).id);
  return json(await updateListing(id, token(request), await readJson(request, partnerSchema)));
});

export const DELETE = handle(async (request: Request, ctx: Ctx) => json(await deleteListing(listingId.parse((await ctx.params).id), token(request))));
