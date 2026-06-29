import { getCache } from "@vercel/functions";

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface CacheOptions<T> {
  fallback?: T;
}

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Failed/empty results are cached only briefly so a transient error (e.g. a
// GitHub rate-limit 403) doesn't hide data for the full TTL.
const EMPTY_TTL_SECONDS = 60;
const RUNTIME_TAG = "github-data";

function isEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0);
}

function hasFallback<T>(
  options: CacheOptions<T> | undefined
): options is { fallback: T } {
  return options != null && "fallback" in options;
}

// Vercel Runtime Cache: per-region, shared across instances, survives cold
// starts and deploys. Returns null off-Vercel (local dev / node) → memory-only.
function runtimeCache() {
  if (!process.env.VERCEL) {
    return null;
  }
  try {
    return getCache();
  } catch {
    return null;
  }
}

function load<T>(
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
      const remote = runtimeCache();

      // Prefer the shared regional cache before hitting the origin, so a cold
      // instance reuses another instance's fetch instead of re-requesting.
      if (remote) {
        try {
          const hit = (await remote.get(key)) as T | null | undefined;
          if (hit != null) {
            memory.set(key, {
              value: hit,
              expiresAt: Date.now() + ttlSeconds * 1000,
            });
            return hit;
          }
        } catch {
          /* ignore runtime-cache read errors; fall through to origin */
        }
      }

      const value = await loader();
      const ttl = isEmpty(value) ? EMPTY_TTL_SECONDS : ttlSeconds;
      memory.set(key, { value, expiresAt: Date.now() + ttl * 1000 });

      if (remote && !isEmpty(value)) {
        try {
          await remote.set(key, value, {
            ttl: ttlSeconds,
            tags: [RUNTIME_TAG],
          });
        } catch {
          /* ignore runtime-cache write errors */
        }
      }

      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * Two-tier, stale-while-revalidate cache:
 *   - in-memory (per instance) for sub-ms reads on warm instances
 *   - Vercel Runtime Cache (per region, shared) so cold starts and other
 *     instances reuse data instead of refetching the origin
 *
 * Fresh hit → return; stale hit → return stale + revalidate in the background;
 * cold miss → await. Concurrent calls for a key share one in-flight request,
 * and failed/empty results expire quickly so they self-heal.
 */
export function withMemoryCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  options?: CacheOptions<T>
): Promise<T> {
  const cached = memory.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }

  if (cached) {
    load(key, ttlSeconds, loader).catch(() => {
      /* keep serving stale on failure */
    });
    return Promise.resolve(cached.value);
  }

  if (hasFallback(options)) {
    load(key, ttlSeconds, loader).catch(() => {
      /* keep serving the local snapshot on failure */
    });
    return Promise.resolve(options.fallback);
  }

  return load(key, ttlSeconds, loader);
}
