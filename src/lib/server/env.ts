import 'server-only';

/**
 * Reads a setting the forgiving way. People paste keys with quotes, with
 * "NAME=" in front, or with a stray space or newline; all of that is removed.
 * The first name in the list that has a value wins.
 */
export function setting(...names: string[]) {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const v = raw.trim().replace(new RegExp(`^${name}\\s*=\\s*`), '').replace(/^["'`]+|["'`]+$/g, '').trim();
    if (v) return v;
  }
  return '';
}

/** Any environment value that is a redis:// URL, whatever Vercel named it (REDIS_URL, STORAGE_REDIS_URL, KV_URL…). */
export function anyRedisUrl() {
  const preferred = setting('REDIS_URL', 'KV_URL', 'STORAGE_URL', 'REDIS_TLS_URL');
  if (/^rediss?:\/\//.test(preferred)) return preferred;
  for (const [name, raw] of Object.entries(process.env)) {
    if (!raw || !/REDIS|KV|STORAGE|DATABASE/i.test(name)) continue;
    const v = setting(name);
    if (/^rediss?:\/\//.test(v)) return v;
  }
  return '';
}
