import 'server-only';
import { wrap } from '@/features/wrapped/logic';
import type { DropLogEntry } from '@/lib/stores/extras';
import type { FeedPost, Session } from '@/lib/types';
import { fmtMinutes, plural } from '@/lib/utils';
import type { Account } from './accounts';
import { getUserData } from './accounts';
import { emailHtml } from './email';

const WEEK = 7 * 86_400_000;

/** The weekly recap email for one person, or null when they did not study this week. */
export async function recapFor(a: Account, posts: FeedPost[], site: string, now = Date.now()) {
  const saved = await getUserData(a.id);
  if (!saved?.data) return null;
  let data: { profile?: { sessions?: Session[] }; extras?: { dropLog?: DropLogEntry[]; water?: Record<string, number> } };
  try {
    data = JSON.parse(saved.data);
  } catch {
    return null;
  }
  const w = wrap({ sessions: data.profile?.sessions ?? [], dropLog: data.extras?.dropLog ?? [], water: data.extras?.water ?? {}, checkins: [], from: now - WEEK, now });
  if (!w.minutes) return null;
  const mine = posts.filter((p) => p.userId === a.id && p.at > now - WEEK);
  const topics = [...new Set(mine.flatMap((p) => p.topics))].slice(0, 6);
  const mates = [...new Set(mine.flatMap((p) => p.with))];
  const lines = [
    `You studied ${fmtMinutes(w.minutes)} across ${plural(w.sessions, 'session')} on ${plural(w.days, 'day')}${w.change !== null ? `, ${w.change >= 0 ? `${w.change}% more` : `${Math.abs(w.change)}% less`} than the week before` : ''}.`,
    [w.subjects[0] ? `Most of it went to ${w.subjects[0].name}.` : '', w.spot ? `Your spot: ${w.spot}.` : '', mates.length ? `You studied with ${mates.slice(0, 3).join(', ')}${mates.length > 3 ? ` and ${mates.length - 3} more` : ''}.` : w.people ? `You studied with ${plural(w.people, 'person', 'people')}.` : ''].filter(Boolean).join(' '),
    topics.length ? `Topics you covered: ${topics.join(', ')}.` : '',
    w.weekday ? `Your best day was ${w.weekday}.` : '',
  ].filter(Boolean);
  const url = `${site}/you?tab=progress`;
  return {
    subject: `Your week: ${fmtMinutes(w.minutes)} of studying`,
    html: emailHtml({ heading: `Nice week, ${a.name.split(' ')[0]}`, paragraphs: lines, button: { label: 'See your week', url }, footer: 'You get this on Sundays when you studied that week. Turn it off in Settings › Account.' }),
    text: `${lines.join('\n\n')}\n\nSee your week: ${url}\n\nTurn these emails off in Settings › Account.`,
  };
}
