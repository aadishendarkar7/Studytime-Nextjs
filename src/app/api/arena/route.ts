import { connection } from 'next/server';
import { requireAccount } from '@/lib/server/accounts';
import { handle, json } from '@/lib/server/http';
import { arenaHome } from '@/lib/server/services/arena';

export const GET = handle(async (request: Request) => {
  await connection();
  return json(await arenaHome(await requireAccount(request)));
});
