interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Failed/empty results are cached only briefly so a transient error (e.g. a
// GitHub rate-limit 403) doesn't hide data for the full TTL.
const EMPTY_TTL_SECONDS = 60;

function isEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0);
}

function refresh<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const value = await loader();
      cache.set(key, {
        value,
        expiresAt:
          Date.now() + (isEmpty(value) ? EMPTY_TTL_SECONDS : ttlSeconds) * 1000,
      });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * In-memory cache with stale-while-revalidate semantics:
 *   - fresh hit  → return cached value
 *   - stale hit  → return stale value immediately, refresh in the background
 *   - cold miss  → await the loader (the only path that blocks the render)
 * Concurrent calls for the same key share a single in-flight request.
 */
export async function withMemoryCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached) {
    // Serve stale now; revalidate without blocking this render.
    void refresh(key, ttlSeconds, loader).catch(() => {
      /* keep serving stale on failure */
    });
    return cached.value;
  }

  return refresh(key, ttlSeconds, loader);
}
