import {
  getRouteCategory,
  getClientIp,
  RateLimiterService,
  checkOtpRateLimit,
  recordFailedOtpAttempt,
  clearOtpAttempts,
  OTP_MAX_ATTEMPTS,
} from '@/app/lib/rateLimiter';
import { POST as verifyOtpPOST } from '@/app/api/Verify-Otp/route';
import { prisma } from '@/app/lib/prisma';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Abuse Prevention & Extended Rate Limiting (Step 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM Route Categorization to Heavy Bucket', () => {
    it('classifies expensive LLM and generation routes into heavy bucket', () => {
      expect(getRouteCategory('/api/descriptive/oral-exam')).toBe('heavy');
      expect(getRouteCategory('/api/descriptive/evaluate')).toBe('heavy');
      expect(getRouteCategory('/api/descriptive/improve')).toBe('heavy');
      expect(getRouteCategory('/api/tests/start')).toBe('heavy');
      expect(getRouteCategory('/api/tests/ocr-math')).toBe('heavy');
      expect(getRouteCategory('/api/settings/verify-ai')).toBe('heavy');
      expect(getRouteCategory('/api/upload')).toBe('heavy');
      expect(getRouteCategory('/api/pdfs/upload')).toBe('heavy');
      expect(getRouteCategory('/api/duels/create')).toBe('heavy');
    });
  });

  describe('Netlify IP Extraction & Spoofing Resistance', () => {
    it('prioritizes trusted Netlify header over client-controlled x-forwarded-for', () => {
      const req = new Request('http://localhost:3000/api/tests', {
        headers: {
          'x-nf-client-connection-ip': '198.51.100.99',
          'client-ip': '203.0.113.1',
          'x-forwarded-for': '10.0.0.1, 127.0.0.1', // Spoofed header
        },
      });

      expect(getClientIp(req)).toBe('198.51.100.99');
    });
  });

  describe('Account-Level Login Backoff (IP-Independent)', () => {
    it('enforces login attempt tracking per account identifier', async () => {
      const service = new RateLimiterService('', ''); // non-production test mode
      const result = await service.checkAccountLoginLimit('target-victim@example.com', false);
      expect(result.allowed).toBe(true);
    });

    it('allows anonymous auth requests without account penalty', async () => {
      const service = new RateLimiterService('', '');
      const result = await service.checkAccountLoginLimit('anonymous', false);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
    });
  });

  describe('Daily LLM Quota Enforcement', () => {
    it('tracks heavy generation quota per user ID', async () => {
      const service = new RateLimiterService('', '');
      const result = await service.checkHeavyDailyQuota('user-12345', false);
      expect(result.allowed).toBe(true);
    });
  });

  describe('OTP Attempt Rate Limiting & Cooldown Protection', () => {
    const testEmail = 'student-test@example.com';

    beforeEach(async () => {
      await clearOtpAttempts(testEmail);
    });

    it('allows initial verification attempt and tracks remaining attempts', async () => {
      const initialStatus = await checkOtpRateLimit(testEmail);
      expect(initialStatus.allowed).toBe(true);
      expect(initialStatus.remainingAttempts).toBe(OTP_MAX_ATTEMPTS);
      expect(initialStatus.isLocked).toBe(false);
    });

    it('decrements remaining attempts on failed submissions', async () => {
      const fail1 = await recordFailedOtpAttempt(testEmail);
      expect(fail1.allowed).toBe(true);
      expect(fail1.remainingAttempts).toBe(4);
      expect(fail1.isLocked).toBe(false);

      const fail2 = await recordFailedOtpAttempt(testEmail);
      expect(fail2.remainingAttempts).toBe(3);
    });

    it('locks out the account after 5 failed attempts with a 15-minute cooldown', async () => {
      for (let i = 0; i < 4; i++) {
        await recordFailedOtpAttempt(testEmail);
      }

      // 5th failed attempt triggers lockout
      const fifthFail = await recordFailedOtpAttempt(testEmail);
      expect(fifthFail.allowed).toBe(false);
      expect(fifthFail.isLocked).toBe(true);
      expect(fifthFail.retryAfterSeconds).toBeGreaterThan(0);
      expect(fifthFail.retryAfterSeconds).toBeLessThanOrEqual(900);

      // Subsequent check confirms locked out
      const checkStatus = await checkOtpRateLimit(testEmail);
      expect(checkStatus.allowed).toBe(false);
      expect(checkStatus.isLocked).toBe(true);
    });

    it('returns 429 from /api/Verify-Otp when account is locked out', async () => {
      // Lock out account
      for (let i = 0; i < 5; i++) {
        await recordFailedOtpAttempt(testEmail);
      }

      const req = new Request('http://localhost:3000/api/Verify-Otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '123456' }),
      });

      const res = await verifyOtpPOST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeDefined();

      // Database should NOT even be queried when locked out
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('clears failed attempts on successful OTP verification', async () => {
      // Fail twice
      await recordFailedOtpAttempt(testEmail);
      await recordFailedOtpAttempt(testEmail);

      // Verify user mock
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: testEmail,
        otp: '654321',
        otpExpiresAt: new Date(Date.now() + 300000),
        isVerified: false,
      });

      const req = new Request('http://localhost:3000/api/Verify-Otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '654321' }),
      });

      const res = await verifyOtpPOST(req);
      expect(res.status).toBe(200);

      // Attempts must be reset
      const resetStatus = await checkOtpRateLimit(testEmail);
      expect(resetStatus.allowed).toBe(true);
      expect(resetStatus.remainingAttempts).toBe(OTP_MAX_ATTEMPTS);
    });
  });
});
