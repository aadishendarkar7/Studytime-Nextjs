/** Channel ids shared by the chat server and the browser. */
export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
export const dmChannel = (a: string, b: string) => `dm-${[a, b].sort().join('-')}`;
export const schoolChannel = (school: string) => `s-${slug(school)}`;
export const courseChannel = (school: string, course: string) => `c-${slug(school) || 'all'}--${slug(course).slice(0, 32)}`;
