import { clientIp, handle, json } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rate-limit';
import { registerProfile } from '@/lib/server/services/leaderboard';

export const POST = handle(async (request: Request) => {
  await rateLimit('lb-register', clientIp(request), 30, 3600, 'Too many registrations. Try again later.');
  return json(await registerProfile(), 201);
});
