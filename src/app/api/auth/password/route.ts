import { z } from 'zod';
import { checkPassword, publicAccount, requireAccount, sessionCookie, setPassword, withCookies } from '@/lib/server/accounts';
import { handle, HttpError, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';

/** Change your password (or add one to a Google account). Signs out your other devices. */
export const PUT = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await rateLimit('password', me.id, 10, 3600, 'Too many tries. Try again later.');
  const { current, next } = await readJson(request, z.object({ current: z.string().max(200).default(''), next: z.string().min(8, 'Use at least 8 characters').max(200) }));
  if (me.password && !(await checkPassword(current, me.password))) throw new HttpError(400, 'Your current password is not right.');
  const account = await setPassword(me.id, next);
  return withCookies({ user: publicAccount(account) }, [sessionCookie(request, account.id, account.sv ?? 0)]);
});
