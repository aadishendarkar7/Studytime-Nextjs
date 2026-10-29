import { createClient } from 'redis';
import type { Storage } from './types';

type Client = ReturnType<typeof createClient>;

/**
 * Storage on a standard Redis database reached with a redis:// URL (REDIS_URL),
 * which is what Vercel's built-in Redis (Storage tab) adds to a project.
 * One connection is opened per server instance and reused.
 */
export class TcpRedisStorage implements Storage {
  private client: Client;
  private ready: Promise<unknown> | null = null;

  constructor(url: string) {
    this.client = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 200, 2000) } });
    this.client.on('error', (error) => console.error('Redis error:', error instanceof Error ? error.message : error));
  }

  private async c() {
    if (!this.client.isOpen) this.ready ??= this.client.connect().finally(() => (this.ready = null));
    if (this.ready) await this.ready;
    return this.client;
  }

  private parse<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(String(raw)) as T;
    } catch {
      return raw as T;
    }
  }

  async get<T>(key: string) {
    return this.parse<T>(await (await this.c()).get(key));
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const c = await this.c();
    if (ttlSeconds) await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
    else await c.set(key, JSON.stringify(value));
  }
  async del(key: string) {
    await (await this.c()).del(key);
  }
  async hget<T>(key: string, field: string) {
    return this.parse<T>(await (await this.c()).hGet(key, field));
  }
  async hset<T>(key: string, field: string, value: T) {
    await (await this.c()).hSet(key, field, JSON.stringify(value));
  }
  async hdel(key: string, field: string) {
    await (await this.c()).hDel(key, field);
  }
  async hgetall<T>(key: string) {
    const raw = ((await (await this.c()).hGetAll(key)) ?? {}) as Record<string, unknown>;
    const out: Record<string, T> = {};
    for (const [field, value] of Object.entries(raw)) out[field] = this.parse<T>(value) as T;
    return out;
  }
  async hlen(key: string) {
    return Number(await (await this.c()).hLen(key));
  }
  async hincrby(key: string, field: string, by: number) {
    return Number(await (await this.c()).hIncrBy(key, field, by));
  }
  async incr(key: string, ttlSeconds: number) {
    const c = await this.c();
    const value = Number(await c.incr(key));
    if (value === 1) await c.expire(key, ttlSeconds);
    return value;
  }
  async expire(key: string, ttlSeconds: number) {
    await (await this.c()).expire(key, ttlSeconds);
  }
}
