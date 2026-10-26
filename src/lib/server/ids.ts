import 'server-only';
import crypto from 'node:crypto';

export const secret = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
export const code = (length: number) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
export const publicId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 16);
export const randomInt = (max: number) => crypto.randomInt(0, max);
export function currentWeek() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
