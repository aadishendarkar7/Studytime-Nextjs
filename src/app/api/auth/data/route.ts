import { connection } from 'next/server';
import { z } from 'zod';
import { getUserData, requireAccount, setUserData } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

const LIMIT = 900_000;

/** Your study data, saved to your account so it follows you to other devices. */
export const GET = handle(async (request: Request) => {
  await connection();
  const account = await requireAccount(request);
  return json((await getUserData(account.id)) ?? { data: null, at: 0 });
});

export const PUT = handle(async (request: Request) => {
  const account = await requireAccount(request);
  await rateLimit('data', account.id, 30, 3600, 'Saving too often. It will try again later.');
  const { data } = await readJson(request, z.object({ data: z.string().max(LIMIT, 'Your data is too large to save online. Export a backup in Settings instead.') }), LIMIT + 1000);
  await setUserData(account.id, data);
  return json({ ok: true, at: Date.now() });
});
