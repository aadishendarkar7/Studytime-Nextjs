import { connection } from 'next/server';
import type { Account } from '@/lib/server/accounts';
import { emailReady, sendEmail, siteUrl } from '@/lib/server/email';
import { handle, HttpError, json } from '@/lib/server/http';
import { currentWeek } from '@/lib/server/ids';
import { recapFor } from '@/lib/server/recap';
import { getStorage } from '@/lib/server/storage';
import type { FeedPost } from '@/lib/types';

export const maxDuration = 60;
/** Resend's free plan sends 100 emails a day. */
const MAX_PER_RUN = Number(process.env.RECAP_MAX_EMAILS) || 90;

/** Sunday evening: email everyone who studied this week a short recap. Called by Vercel Cron (see vercel.json). */
export const GET = handle(async (request: Request) => {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Not allowed.');
  if (!emailReady()) return json({ sent: 0, note: 'Email is not set up.' });
  const s = getStorage();
  const week = currentWeek();
  const accounts = Object.values(await s.hgetall<Account>('users'));
  const posts = Object.values(await s.hgetall<FeedPost>('feed-posts'));
  let sent = 0;
  for (const a of accounts) {
    if (sent >= MAX_PER_RUN) break;
    if (a.recapEmail === false || (await s.get(`recap-sent:${a.id}:${week}`))) continue;
    const mail = await recapFor(a, posts, siteUrl(request));
    if (!mail) continue;
    try {
      await sendEmail(a.email, mail.subject, mail.html, mail.text);
      await s.set(`recap-sent:${a.id}:${week}`, 1, 8 * 86_400);
      sent++;
    } catch {
      /* keep going with the next person */
    }
  }
  return json({ sent });
});
