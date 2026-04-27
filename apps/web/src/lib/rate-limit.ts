// Simple in-memory sliding window rate limiter.
// Not shared across serverless instances — use Upstash Redis for strict enforcement.
// Still catches single-instance abuse and protects against runaway loops.

type Window = { count: number; resetAt: number };
const store = new Map<string, Window>();

export const rateLimit = (key: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  const w = store.get(key);

  if (!w || now > w.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (w.count >= limit) return false;
  w.count++;
  return true;
};
