interface Bucket {
  startedAt: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
const activeRequests = new Map<string, number>();

function cleanup(now: number): void {
  if (buckets.size < 5000) return;
  buckets.forEach((bucket, key) => {
    if (now - bucket.startedAt > 60 * 60 * 1000) buckets.delete(key);
  });
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanup(now);
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count < maxRequests) {
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000))
  };
}

export function tryAcquireConcurrency(key: string, maxConcurrent: number): (() => void) | null {
  const current = activeRequests.get(key) || 0;
  if (current >= maxConcurrent) return null;

  activeRequests.set(key, current + 1);
  return () => {
    const next = (activeRequests.get(key) || 1) - 1;
    if (next <= 0) activeRequests.delete(key);
    else activeRequests.set(key, next);
  };
}
