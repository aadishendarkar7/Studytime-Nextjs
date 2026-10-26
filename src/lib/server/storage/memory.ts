import type { Storage } from './types';

type Entry = { value: unknown; expiresAt?: number };

/** In-memory storage. Used by tests and as the base of the file driver. */
export class MemoryStorage implements Storage {
  protected data = new Map<string, Entry>();

  protected onChange(): void {}

  protected live(key: string): Entry | undefined {
    const entry = this.data.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  private hash(key: string, create = false): Record<string, unknown> | undefined {
    const entry = this.live(key);
    if (entry) return entry.value as Record<string, unknown>;
    if (!create) return undefined;
    const value: Record<string, unknown> = {};
    this.data.set(key, { value });
    return value;
  }

  private clone<T>(value: T): T {
    return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
  }

  async get<T>(key: string) {
    const entry = this.live(key);
    return entry ? this.clone(entry.value as T) : null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    this.data.set(key, { value: this.clone(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
    this.onChange();
  }
  async del(key: string) {
    this.data.delete(key);
    this.onChange();
  }
  async hget<T>(key: string, field: string) {
    const h = this.hash(key);
    return h && field in h ? this.clone(h[field] as T) : null;
  }
  async hset<T>(key: string, field: string, value: T) {
    this.hash(key, true)![field] = this.clone(value);
    this.onChange();
  }
  async hdel(key: string, field: string) {
    const h = this.hash(key);
    if (h) delete h[field];
    this.onChange();
  }
  async hgetall<T>(key: string) {
    return this.clone((this.hash(key) ?? {}) as Record<string, T>);
  }
  async hlen(key: string) {
    return Object.keys(this.hash(key) ?? {}).length;
  }
  async hincrby(key: string, field: string, by: number) {
    const h = this.hash(key, true)!;
    h[field] = (Number(h[field]) || 0) + by;
    this.onChange();
    return h[field] as number;
  }
  async incr(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    const next = (Number(entry?.value) || 0) + 1;
    this.data.set(key, { value: next, expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return next;
  }
  async expire(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
    this.onChange();
  }
}
