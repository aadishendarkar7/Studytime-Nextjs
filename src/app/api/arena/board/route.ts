import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { arenaBoard } from '@/lib/server/services/arena';

export const GET = handle(async (request: Request) => {
  await connection();
  const me = await requireAccount(request);
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const kind = url.searchParams.get('kind') === 'week' ? 'week' : 'rating';
  return json({ entries: await arenaBoard(me, scope === 'school' || scope === 'following' ? scope : 'all', kind) });
});
