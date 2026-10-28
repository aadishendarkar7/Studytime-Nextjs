import { z } from 'zod';
import { checkPassword, clearCookie, deleteAccount, requireAccount, withCookies } from '@/lib/server/accounts';
import { handle, HttpError, readJson } from '@/lib/server/http';
import { removeUserSocial } from '@/lib/server/services/feed';

/** Delete your account and everything saved with it. */
export const DELETE = handle(async (request: Request) => {
  const me = await requireAccount(request);
  const { password, confirm } = await readJson(request, z.object({ password: z.string().max(200).default(''), confirm: z.string().max(20).default('') }));
  if (me.password ? !(await checkPassword(password, me.password)) : confirm !== 'DELETE') throw new HttpError(400, me.password ? 'Your password is not right.' : 'Type DELETE to confirm.');
  await deleteAccount(me, removeUserSocial);
  return withCookies({ ok: true }, [clearCookie(request)]);
});
