import { z } from 'zod';
import { publicAccount, requireAccount, updateAccount } from '@/lib/server/accounts';
import { handle, json, readJson } from '@/lib/server/http';

const text = (n: number) => z.string().trim().max(n);
const schema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  school: text(80).optional(),
  major: text(60).optional(),
  year: text(10).optional(),
  courses: z.array(text(30)).max(12).optional(),
  onboarded: z.boolean().optional(),
});

export const PUT = handle(async (request: Request) => {
  const account = await requireAccount(request);
  const { name, onboarded, ...profile } = await readJson(request, schema);
  const next = await updateAccount(account.id, { name, onboarded, profile });
  return json({ user: publicAccount(next) });
});
