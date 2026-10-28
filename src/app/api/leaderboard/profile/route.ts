import { z } from 'zod';
import { handle, json, readJson } from '@/lib/server/http';
import { updateProfile } from '@/lib/server/services/leaderboard';
import { minutesSchema, nameSchema } from '@/lib/server/validation';

const cohort = z.string().optional().transform((v) => (v || '').trim().slice(0, 80));

export const PUT = handle(async (request: Request) => {
  const body = await readJson(
    request,
    z.object({ name: nameSchema, school: cohort, major: cohort, year: z.string().optional().transform((v) => (['1', '2', '3', '4', '5'].includes(String(v)) ? String(v) : '')), minutes: minutesSchema, drops: z.coerce.number().int().min(0).max(200).catch(0).default(0) }),
  );
  return json(await updateProfile(request.headers.get('x-leader-token'), body));
});
