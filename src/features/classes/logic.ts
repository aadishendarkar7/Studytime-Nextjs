import { courseName } from '@/features/calendar/routine';

export const courseKey = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const CODE = /\b([A-Z]{2,5})\s?-?(\d{3}[A-Z]?)\b/;

/** A course code in a title like "HW 5 [STAT400-0101-Fall2026]", or null. */
export function codeIn(title: string) {
  const m = CODE.exec(title.toUpperCase());
  return m ? `${m[1]}${m[2]}` : null;
}

/** Your classes: the ones on your profile, then any found in your calendars. */
export function myClasses(profileCourses: string[], titles: string[]) {
  const out = new Map<string, { code: string; fromCalendar: boolean }>();
  for (const c of profileCourses) if (courseKey(c)) out.set(courseKey(c), { code: courseKey(c), fromCalendar: false });
  for (const t of titles) {
    const c = codeIn(t) ?? (CODE.test(courseName(t).toUpperCase()) ? courseKey(courseName(t)) : null);
    if (c && !out.has(c)) out.set(c, { code: c, fromCalendar: true });
  }
  return [...out.values()];
}

/** Does this title belong to this course? */
export const isFor = (title: string, code: string) => courseKey(title).includes(courseKey(code));
