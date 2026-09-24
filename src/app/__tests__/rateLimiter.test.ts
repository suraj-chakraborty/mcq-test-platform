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

  describe('Configured Rate Limiter Check', () => {
    it('delegates to Upstash limiter and handles limit exceeded', async () => {
      const mockLimitFn = jest.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 30000,
      });

      const service = new RateLimiterService('', '');
      // Inject mock limiter
      (service as any).limiters = {
        heavy: { limit: mockLimitFn },
      };

      const result = await service.checkLimit('heavy', 'ip:1.2.3.4', true);
      expect(mockLimitFn).toHaveBeenCalledWith('ip:1.2.3.4');
      expect(result.allowed).toBe(false);
      expect(result.errorReason).toBe('RATE_EXCEEDED');
      expect(result.remaining).toBe(0);
    });
  });
});
