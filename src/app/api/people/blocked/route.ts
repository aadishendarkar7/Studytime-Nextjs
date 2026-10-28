import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { blockedPeople } from '@/lib/server/services/feed';

export const GET = handle(async (request: Request) => {
  await connection();
  return json({ people: await blockedPeople(await requireAccount(request)) });
});
