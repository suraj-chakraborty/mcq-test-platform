import { clientCache, fetchWithCache } from '@/app/lib/clientCache';

describe('clientCache & fetchWithCache', () => {
  beforeEach(() => {
    clientCache.clear();
    jest.clearAllMocks();
  });

  describe('clientCache store', () => {
    it('stores and retrieves cached entries within TTL', () => {
      clientCache.set('key1', { test: true }, 5000);
      expect(clientCache.get('key1')).toEqual({ test: true });
    });

    it('returns null for expired entries', () => {
      clientCache.set('expiredKey', { test: true }, -10); // immediately expired
      expect(clientCache.get('expiredKey')).toBeNull();
    });

    it('invalidates cache entries by exact key and prefix', () => {
      clientCache.set('/api/tests', [1, 2]);
      clientCache.set('/api/tests?page=1', [1]);
      clientCache.set('/api/flashcards', [3, 4]);

      clientCache.invalidate('/api/tests');
      expect(clientCache.get('/api/tests')).toBeNull();
      expect(clientCache.get('/api/tests?page=1')).toBeNull();
      expect(clientCache.get('/api/flashcards')).toEqual([3, 4]);
    });
  });

  describe('fetchWithCache', () => {
    it('caches response data and avoids repeat network calls', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 42 }),
      });
      global.fetch = mockFetch;

      const first = await fetchWithCache<{ success: boolean; count: number }>('/api/tests');
      expect(first).toEqual({ success: true, count: 42 });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should come from cache
      const second = await fetchWithCache<{ success: boolean; count: number }>('/api/tests');
      expect(second).toEqual({ success: true, count: 42 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('deduplicates simultaneous in-flight requests to identical URLs', async () => {
      let resolveFetch: (val: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      const mockFetch = jest.fn().mockImplementation(() =>
        fetchPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => ({ deduplicated: true }),
        }))
      );
      global.fetch = mockFetch;

      // Initiate two calls concurrently
      const call1 = fetchWithCache('/api/concurrent-test');
      const call2 = fetchWithCache('/api/concurrent-test');

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch!(true);

      const [res1, res2] = await Promise.all([call1, call2]);
      expect(res1).toEqual({ deduplicated: true });
      expect(res2).toEqual({ deduplicated: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('forceFresh forces a network call despite existing cache', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ version: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ version: 2 }),
        });
      global.fetch = mockFetch;

      const first = await fetchWithCache('/api/version');
      expect(first).toEqual({ version: 1 });

      const second = await fetchWithCache('/api/version', { forceFresh: true });
      expect(second).toEqual({ version: 2 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('non-GET requests bypass cache and invalidate target endpoint', async () => {
      clientCache.set('/api/items', [{ id: 1 }]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;

      await fetchWithCache('/api/items', { method: 'POST', body: JSON.stringify({ id: 2 }) });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // /api/items cache should now be invalidated
      expect(clientCache.get('/api/items')).toBeNull();
    });
  });
});
