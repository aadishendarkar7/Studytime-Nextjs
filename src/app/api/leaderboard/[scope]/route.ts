import { type NextRequest } from 'next/server';
import { handle, HttpError, json } from '@/lib/server/http';
import { classLeaderboard } from '@/lib/server/services/classes';
import { scopedLeaderboard } from '@/lib/server/services/leaderboard';
import { classCode } from '@/lib/server/validation';

export const GET = handle(async (request: NextRequest, ctx: RouteContext<'/api/leaderboard/[scope]'>) => {
  const { scope } = await ctx.params;
  if (scope === 'class') {
    const code = classCode.parse((request.nextUrl.searchParams.get('code') || '').toUpperCase());
    const result = await classLeaderboard(code, request.headers.get('x-class-token') || '').catch(() => {
      throw new HttpError(404, 'Join a class in Friends & classmates first');
    });
    return json({ scope, ...result });
  }
  if (scope !== 'school' && scope !== 'major' && scope !== 'year') throw new HttpError(404, 'Not found');
  return json(await scopedLeaderboard(request.headers.get('x-leader-token'), scope));
});
