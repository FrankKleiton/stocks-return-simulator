type Entry<T> = { expires: number; data: T };
const memory = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.data;
  const data = await loader();
  memory.set(key, { expires: now + ttlMs, data });
  return data;
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, delayMs * (i + 1))); }
  }
  throw last;
}
