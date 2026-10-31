import { z } from 'zod';
import { requireAccount } from '@/lib/server/accounts';
import { clientIp, handle, json, readJson } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { removeAvatar, setAvatar } from '@/lib/server/services/avatars';

/** Upload or remove your profile picture. */
export const PUT = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await rateLimit('avatar', clientIp(request), 20, 3600, 'Too many picture changes. Try again later.');
  const { image } = await readJson(request, z.object({ image: z.string().max(130_000) }));
  await setAvatar(me.id, image);
  return json({ ok: true, at: Date.now() });
});

export const DELETE = handle(async (request: Request) => {
  const me = await requireAccount(request);
  await removeAvatar(me.id);
  return json({ ok: true });
});
