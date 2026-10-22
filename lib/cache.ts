import { isUpstreamError } from './upstreamError';

type Entry<T> = { expires: number; data: T };
const memory = new Map<string, Entry<unknown>>();

/** Longest we are willing to sleep on a provider-suggested Retry-After before giving up. */
const MAX_RETRY_AFTER_MS = 20_000;

export function peek<T>(key: string): T | undefined {
  const hit = memory.get(key) as Entry<T> | undefined;
  return hit && hit.expires > Date.now() ? hit.data : undefined;
}

export function put<T>(key: string, ttlMs: number, data: T) {
  memory.set(key, { expires: Date.now() + ttlMs, data });
}

export const clearCache = () => memory.clear();

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = peek<T>(key);
  if (hit !== undefined) return hit;
  const data = await loader();
  put(key, ttlMs, data);
  return data;
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      let wait = delayMs * (i + 1);
      if (isUpstreamError(e)) {
        if (!e.retryable) break;
        if (e.retryAfterMs) {
          if (e.retryAfterMs > MAX_RETRY_AFTER_MS) break;
          wait = e.retryAfterMs;
        }
      }
      if (i < attempts - 1) await new Promise(r => setTimeout(r, wait));
    }
  }
  throw last;
}
