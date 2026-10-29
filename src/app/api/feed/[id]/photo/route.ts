import { requireAccount } from '@/lib/server/accounts';
import { handle } from '@/lib/server/http';
import { postPhoto } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request, ctx: RouteContext<'/api/feed/[id]/photo'>) => {
  const me = await requireAccount(request);
  const { type, bytes } = await postPhoto(me, (await ctx.params).id);
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': type, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
});
