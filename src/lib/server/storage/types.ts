/**
 * Minimal key-value + hash storage contract. Every server feature uses this
 * interface, so swapping the backend (local file, Redis, memory) needs no
 * changes to the feature code. Values are JSON-serializable.
 */
export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset<T>(key: string, field: string, value: T): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hlen(key: string): Promise<number>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  /** Increment a counter that expires after ttlSeconds (used for rate limits). */
  incr(key: string, ttlSeconds: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}
