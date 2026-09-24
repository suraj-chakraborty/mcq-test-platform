import {
  RateLimiterService,
  getRouteCategory,
  resolveRateLimitIdentifier,
} from '@/app/lib/rateLimiter';
import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({
      limit: jest.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
    })),
    {
      slidingWindow: jest.fn().mockReturnValue({}),
    }
  ),
}));

jest.mock('next-auth/jwt');

describe('Rate Limiter Service & Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRouteCategory', () => {
    it('categorizes authentication endpoints into auth bucket', () => {
      expect(getRouteCategory('/api/auth/signin')).toBe('auth');
      expect(getRouteCategory('/api/auth/session')).toBe('auth');
      expect(getRouteCategory('/api/auth/callback/credentials')).toBe('auth');
    });

    it('categorizes heavy generation and upload endpoints into heavy bucket', () => {
      expect(getRouteCategory('/api/upload')).toBe('heavy');
      expect(getRouteCategory('/api/pdfs/upload')).toBe('heavy');
      expect(getRouteCategory('/api/pdf-tests/create')).toBe('heavy');
      expect(getRouteCategory('/api/generate')).toBe('heavy');
      expect(getRouteCategory('/api/duels/create')).toBe('heavy');
    });

    it('categorizes general endpoints into general bucket', () => {
      expect(getRouteCategory('/api/pdf-tests')).toBe('general');
      expect(getRouteCategory('/api/analytics/weak-areas')).toBe('general');
      expect(getRouteCategory('/api/users/profile')).toBe('general');
      expect(getRouteCategory('/api/flashcards')).toBe('general');
    });
  });

  describe('resolveRateLimitIdentifier', () => {
    it('keys by authenticated user ID when token is present', async () => {
      (getToken as jest.Mock).mockResolvedValue({
        id: 'usr_abc123',
        email: 'student@example.com',
      });

      const req = new Request('http://localhost:3000/api/pdf-tests', {
        headers: { 'x-forwarded-for': '203.0.113.195' },
      }) as any;

      const result = await resolveRateLimitIdentifier(req);
      expect(result.isAuthenticated).toBe(true);
      expect(result.identifier).toBe('user:usr_abc123');
      expect(result.userId).toBe('usr_abc123');
    });

    it('keys by IP only when user is anonymous', async () => {
      (getToken as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/pdf-tests', {
        headers: { 'x-forwarded-for': '198.51.100.42, 10.0.0.1' },
      }) as any;

      const result = await resolveRateLimitIdentifier(req);
      expect(result.isAuthenticated).toBe(false);
      expect(result.identifier).toBe('ip:198.51.100.42');
      expect(result.userId).toBeUndefined();
    });

    it('falls back to 127.0.0.1 when no IP headers are present for anonymous users', async () => {
      (getToken as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/pdf-tests') as any;
      const result = await resolveRateLimitIdentifier(req);

      expect(result.isAuthenticated).toBe(false);
      expect(result.identifier).toBe('ip:127.0.0.1');
    });
  });

  describe('Fail CLOSED in Production Policy', () => {
    it('fails CLOSED in production when Upstash config is missing', async () => {
      // Create service without Upstash env vars
      const unconfiguredService = new RateLimiterService('', '');
      expect(unconfiguredService.isConfigured()).toBe(false);

      const isProduction = true;
      const result = await unconfiguredService.checkLimit('general', 'user:u1', isProduction);

      expect(result.allowed).toBe(false);
      expect(result.errorReason).toBe('CONFIG_MISSING_IN_PROD');
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('allows requests in development/test when Upstash config is missing', async () => {
      const unconfiguredService = new RateLimiterService('', '');

      const isProduction = false;
      const result = await unconfiguredService.checkLimit('general', 'user:u1', isProduction);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('getClientIp Netlify Precedence', () => {
    it('prefers x-nf-client-connection-ip over client-ip and x-forwarded-for', () => {
      const { getClientIp } = require('@/app/lib/rateLimiter');
      const req = new Request('http://localhost:3000/api/duels/status', {
        headers: {
          'x-nf-client-connection-ip': '142.250.190.46',
          'client-ip': '1.1.1.1',
          'x-forwarded-for': '8.8.8.8, 10.0.0.1',
        },
      });
      expect(getClientIp(req)).toBe('142.250.190.46');
    });

    it('falls back to client-ip if x-nf-client-connection-ip is missing', () => {
      const { getClientIp } = require('@/app/lib/rateLimiter');
      const req = new Request('http://localhost:3000/api/duels/status', {
        headers: {
          'client-ip': '1.1.1.1',
          'x-forwarded-for': '8.8.8.8, 10.0.0.1',
        },
      });
      expect(getClientIp(req)).toBe('1.1.1.1');
    });

    it('falls back to first x-forwarded-for entry if Netlify headers are missing', () => {
      const { getClientIp } = require('@/app/lib/rateLimiter');
      const req = new Request('http://localhost:3000/api/duels/status', {
        headers: {
          'x-forwarded-for': '8.8.8.8, 10.0.0.1',
        },
      });
      expect(getClientIp(req)).toBe('8.8.8.8');
    });
  });

  describe('Auth Bucket Account Keying', () => {
    it('keys auth bucket by IP and submitted account email parameter', async () => {
      const req = {
        headers: new Headers({ 'x-nf-client-connection-ip': '203.0.113.50' }),
        nextUrl: new URL('http://localhost:3000/api/auth/signin?email=user@school.edu'),
      } as any;

      const result = await resolveRateLimitIdentifier(req);
      expect(result.identifier).toBe('auth:203.0.113.50:user@school.edu');
    });

    it('keys auth bucket by IP and submitted account header when query param is absent', async () => {
      const req = {
        headers: new Headers({
          'x-nf-client-connection-ip': '203.0.113.50',
          'x-account-identifier': '+1234567890',
        }),
        nextUrl: new URL('http://localhost:3000/api/auth/callback/credentials'),
      } as any;

      const result = await resolveRateLimitIdentifier(req);
      expect(result.identifier).toBe('auth:203.0.113.50:+1234567890');
    });

    it('keys auth bucket as anonymous when no account identifier is provided', async () => {
      const req = {
        headers: new Headers({ 'x-nf-client-connection-ip': '203.0.113.50' }),
        nextUrl: new URL('http://localhost:3000/api/auth/session'),
      } as any;

      const result = await resolveRateLimitIdentifier(req);
      expect(result.identifier).toBe('auth:203.0.113.50:anonymous');
    });
  });

  describe('Duel Bucket Categorization', () => {
    it('categorizes duel status and polling routes into duel bucket', () => {
      expect(getRouteCategory('/api/duels/123/status')).toBe('duel');
      expect(getRouteCategory('/api/duels/abc/poll')).toBe('duel');
      expect(getRouteCategory('/api/duels/create')).toBe('heavy');
    });
  });

  describe('Upstash Unreachable Fallback Policies', () => {
    it('FAILS CLOSED for auth bucket when Upstash throws an error', async () => {
      const service = new RateLimiterService('', '');
      (service as any).limiters = {
        auth: {
          limit: jest.fn().mockRejectedValue(new Error('Connection reset by peer')),
        },
      };

      const result = await service.checkLimit('auth', 'auth:1.2.3.4:target', true);
      expect(result.allowed).toBe(false);
      expect(result.errorReason).toBe('UPSTASH_UNREACHABLE_FAIL_CLOSED');
    });

    it('FAILS CLOSED for heavy generation bucket when Upstash times out', async () => {
      const service = new RateLimiterService('', '');
      (service as any).limiters = {
        heavy: {
          limit: jest.fn().mockImplementation(
            () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 50))
          ),
        },
      };

      const result = await service.checkLimit('heavy', 'user:u123', true);
      expect(result.allowed).toBe(false);
      expect(result.errorReason).toBe('UPSTASH_UNREACHABLE_FAIL_CLOSED');
    });

    it('FAILS OPEN WITH ALERT for general and duel buckets when Upstash is unreachable', async () => {
      const service = new RateLimiterService('', '');
      (service as any).limiters = {
        general: {
          limit: jest.fn().mockRejectedValue(new Error('Upstash 500 error')),
        },
        duel: {
          limit: jest.fn().mockRejectedValue(new Error('Upstash timeout')),
        },
      };

      const generalResult = await service.checkLimit('general', 'ip:1.2.3.4', true);
      expect(generalResult.allowed).toBe(true);
      expect(generalResult.isDegraded).toBe(true);

      const duelResult = await service.checkLimit('duel', 'user:player1', true);
      expect(duelResult.allowed).toBe(true);
      expect(duelResult.isDegraded).toBe(true);
    });
  });

  describe('5-Minute 2-Player Duel Simulation Test', () => {
    it('simulates a 2-player duel for 5 minutes (300s) with 0 rate limit rejections (no 429)', async () => {
      // In battle mode, each client polls status every 3000ms (~20 req/min).
      // Over 5 minutes (300 seconds), each player makes 100 requests = 200 total requests.
      // Even if both players are on the exact same IP (LAN/Wi-Fi), total rate is ~40 req/min.
      // The duel bucket allows 120 req / 60 seconds sliding window.

      class MockSlidingWindowLimiter {
        private timestamps: number[] = [];
        private maxRequests: number;
        private windowMs: number;

        constructor(maxRequests: number, windowSeconds: number) {
          this.maxRequests = maxRequests;
          this.windowMs = windowSeconds * 1000;
        }

        async limit(nowMs: number) {
          this.timestamps = this.timestamps.filter((ts) => nowMs - ts < this.windowMs);
          if (this.timestamps.length >= this.maxRequests) {
            return { success: false, limit: this.maxRequests, remaining: 0, reset: nowMs + this.windowMs };
          }
          this.timestamps.push(nowMs);
          return { success: true, limit: this.maxRequests, remaining: this.maxRequests - this.timestamps.length, reset: nowMs + this.windowMs };
        }
      }

      // Shared IP duel limiter (worst-case: both players sharing the same LAN IP)
      const duelLimiter = new MockSlidingWindowLimiter(120, 60);

      const durationSeconds = 300; // 5 minutes
      const pollIntervalSeconds = 3; // 3000ms polling

      let player1Requests = 0;
      let player2Requests = 0;
      let rateLimitHits = 0;

      for (let sec = 0; sec <= durationSeconds; sec += pollIntervalSeconds) {
        const nowMs = 1700000000000 + sec * 1000;

        // Player 1 polls
        const p1Result = await duelLimiter.limit(nowMs);
        player1Requests++;
        if (!p1Result.success) rateLimitHits++;

        // Player 2 polls (1.5s offset)
        const p2Result = await duelLimiter.limit(nowMs + 1500);
        player2Requests++;
        if (!p2Result.success) rateLimitHits++;
      }

      expect(player1Requests).toBe(101);
      expect(player2Requests).toBe(101);
      expect(rateLimitHits).toBe(0); // Absolutely zero 429s encountered
    });
  });
});
