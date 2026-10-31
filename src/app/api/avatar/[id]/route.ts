import { handle } from '@/lib/server/http';
import { getAvatar } from '@/lib/server/services/avatars';

/** Someone's profile picture. Missing pictures answer 404 and the app shows their initial instead. */
export const GET = handle(async (_request: Request, ctx: RouteContext<'/api/avatar/[id]'>) => {
  const { type, bytes } = await getAvatar((await ctx.params).id);
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': type, 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
});
