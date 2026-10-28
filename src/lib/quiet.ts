import { useExtras } from '@/lib/stores/extras';

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Is `at` inside the quiet window? Handles windows that cross midnight, like 23:00 to 07:00. */
export function inQuietHours(quiet: { on: boolean; from: string; to: string }, at = new Date()) {
  if (!quiet.on) return false;
  const from = minutes(quiet.from);
  const to = minutes(quiet.to);
  if (from === null || to === null || from === to) return false;
  const now = at.getHours() * 60 + at.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** True during your quiet hours: no pop-ups, reminders to drink water, or nudges. */
export const isQuietNow = () => inQuietHours(useExtras.getState().quiet);
