import 'server-only';
import path from 'node:path';
import { FileStorage } from './file';
import { MemoryStorage } from './memory';
import { RedisStorage } from './redis';
import { TcpRedisStorage } from './redis-tcp';
import type { Storage } from './types';

export type { Storage };

let instance: Storage | null = null;

/**
 * Picks the storage backend from environment variables:
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/TOKEN) → Upstash Redis over HTTPS
 * - REDIS_URL (redis://…, from Vercel's Redis) → Redis over a normal connection
 * - STORAGE_DRIVER=memory → in-memory (tests)
 * - otherwise → JSON file in .data/ (local development)
 */
/** A redis:// or rediss:// URL, as added by Vercel's Redis (Storage tab) or Redis Cloud. */
const redisUrl = () => [process.env.REDIS_URL, process.env.KV_URL, process.env.STORAGE_URL].find((u) => u && /^rediss?:\/\//.test(u.trim()))?.trim();

/** Where data is kept: 'redis' (lasts), 'file' (your own computer), or 'memory' (lost on every restart). */
export function storageKind(): 'redis' | 'file' | 'memory' {
  if ((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) return 'redis';
  if (redisUrl()) return 'redis';
  if (process.env.STORAGE_DRIVER === 'memory' || process.env.VERCEL) return 'memory';
  return 'file';
}

export function getStorage(): Storage {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) instance = new RedisStorage(url, token);
  else if (redisUrl()) instance = new TcpRedisStorage(redisUrl()!);
  // On Vercel there is no lasting disk, so without Redis data only lives in memory.
  else if (process.env.STORAGE_DRIVER === 'memory' || process.env.VERCEL) instance = new MemoryStorage();
  else instance = new FileStorage(path.join(process.cwd(), '.data', 'studytime.json'));
  return instance;
}

/** Test hook: replace the storage backend. */
export function setStorage(storage: Storage) {
  instance = storage;
}
