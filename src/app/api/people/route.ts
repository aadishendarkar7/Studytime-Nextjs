import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { searchPeople } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request) => {
  await connection();
  const me = await requireAccount(request);
  return json({ people: await searchPeople(me, (new URL(request.url).searchParams.get('q') || '').slice(0, 60)) });
});
