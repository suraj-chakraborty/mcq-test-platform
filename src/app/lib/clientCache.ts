/**
 * Lightweight, zero-dependency in-memory client cache with SWR (stale-while-revalidate)
 * semantics, TTL expiration, and in-flight request deduplication.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes default TTL

export const clientCache = {
  get<T>(key: string): T | null {
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
    if (isExpired) return null;
    return entry.data;
  },

  getStale<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const isStale = Date.now() - entry.timestamp > entry.ttlMs;
    return { data: entry.data, isStale };
  },

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
    memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  },

  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      memoryCache.clear();
      return;
    }
    for (const key of Array.from(memoryCache.keys())) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        memoryCache.delete(key);
      }
    }
  },

  clear(): void {
    memoryCache.clear();
    inFlightRequests.clear();
  },
};

export interface FetchWithCacheOptions extends RequestInit {
  ttlMs?: number;
  forceFresh?: boolean;
}

/**
 * Performs a fetch with in-memory caching and request deduplication.
 * - If fresh cached data exists and forceFresh is false, returns cached data immediately.
 * - If multiple identical GET requests are initiated concurrently, they share the same network promise.
 * - Non-GET requests bypass the cache and automatically invalidate matching cached paths.
 */
export async function fetchWithCache<T = unknown>(
  url: string,
  options: FetchWithCacheOptions = {}
): Promise<T> {
  const { ttlMs = DEFAULT_CACHE_TTL_MS, forceFresh = false, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Non-GET requests bypass read cache and invalidate target endpoint prefix
  if (method !== 'GET') {
    const res = await fetch(url, fetchOptions);
    const data = await res.json();
    const path = url.split('?')[0];
    clientCache.invalidate(path);
    return data as T;
  }

  const cacheKey = url;

  // Check cache if fresh data is not explicitly required
  if (!forceFresh) {
    const cached = clientCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Request Deduplication: if request is already in-flight, return the existing promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const requestPromise = (async () => {
    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      clientCache.set(cacheKey, data, ttlMs);
      return data as T;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}
