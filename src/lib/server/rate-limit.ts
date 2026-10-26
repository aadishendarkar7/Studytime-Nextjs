import 'server-only';
import { getStorage } from './storage';
import { HttpError } from './http';

/** Fixed-window rate limit. Throws 429 when exceeded. */
export async function rateLimit(bucket: string, id: string, limit: number, windowSeconds: number, message: string) {
  if (limit <= 0) return;
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const count = await getStorage().incr(`rl:${bucket}:${id}:${window}`, windowSeconds + 5);
  if (count > limit) throw new HttpError(429, message);
}
