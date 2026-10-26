import { Redis } from '@upstash/redis';
import type { Storage } from './types';

/** Production storage on Upstash Redis (works on serverless hosts like Vercel). */
export class RedisStorage implements Storage {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token, automaticDeserialization: false });
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
    return this.parse<T>(await this.redis.get(key));
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
    else await this.redis.set(key, JSON.stringify(value));
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async hget<T>(key: string, field: string) {
    return this.parse<T>(await this.redis.hget(key, field));
  }
  async hset<T>(key: string, field: string, value: T) {
    await this.redis.hset(key, { [field]: JSON.stringify(value) });
  }
  async hdel(key: string, field: string) {
    await this.redis.hdel(key, field);
  }
  async hgetall<T>(key: string) {
    const raw = ((await this.redis.hgetall(key)) ?? {}) as Record<string, unknown>;
    const out: Record<string, T> = {};
    for (const [field, value] of Object.entries(raw)) out[field] = this.parse<T>(value) as T;
    return out;
  }
  async hlen(key: string) {
    return this.redis.hlen(key);
  }
  async hincrby(key: string, field: string, by: number) {
    return this.redis.hincrby(key, field, by);
  }
  async incr(key: string, ttlSeconds: number) {
    const value = await this.redis.incr(key);
    if (value === 1) await this.redis.expire(key, ttlSeconds);
    return value;
  }
  async expire(key: string, ttlSeconds: number) {
    await this.redis.expire(key, ttlSeconds);
  }
}
