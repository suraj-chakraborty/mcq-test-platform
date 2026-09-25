import { POST as mobileLoginPOST } from '../api/mobile/v1/auth/login/route';
import { POST as mobileRegisterPOST } from '../api/mobile/v1/auth/register/route';
import { POST as mobileVerifyOtpPOST } from '../api/mobile/v1/auth/verify-otp/route';
import { POST as mobileRefreshPOST } from '../api/mobile/v1/auth/refresh/route';
import { POST as mobileLogoutPOST } from '../api/mobile/v1/auth/logout/route';
import { POST as mobileForgotPasswordPOST } from '../api/mobile/v1/auth/forgot-password/route';
import { POST as mobileResetPasswordPOST } from '../api/mobile/v1/auth/reset-password/route';
import { GET as mobileMeGET } from '../api/mobile/v1/auth/me/route';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { decode } from 'next-auth/jwt';
import { hashRefreshToken } from '@/app/lib/mobileAuth';

jest.mock('@/app/lib/send-mail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('bcryptjs');

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    mobileRefreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    testAttempt: {
      count: jest.fn().mockResolvedValue(5),
    },
    flashcard: {
      count: jest.fn().mockResolvedValue(12),
    },
    achievement: {
      count: jest.fn().mockResolvedValue(3),
    },
  },
}));

describe('Phase 2: Mobile v1 Auth API Endpoints', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  });

  describe('POST /api/mobile/v1/auth/login', () => {
    it('returns 400 for invalid email format', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad-email', password: 'Password123!' }),
      });

      const res = await mobileLoginPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('returns 401 when password does not match', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        password: '$2a$12$hashedPassword',
        isVerified: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'WrongPassword' }),
      });

      const res = await mobileLoginPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('Invalid email or password');
    });

    it('returns 403 when user email is not verified', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'unverified@example.com',
        password: '$2a$12$hashedPassword',
        isVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unverified@example.com', password: 'Password123!' }),
      });

      const res = await mobileLoginPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Email not verified');
    });

    it('issues short-lived access token and 30-day refresh token on valid login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-verified-1',
        name: 'Mobile Scholar',
        email: 'scholar@example.com',
        password: '$2a$12$hashedPassword',
        isVerified: true,
        xp: 1500,
        level: 2,
        streak: 5,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      ((prisma as any).mobileRefreshToken.create as jest.Mock).mockResolvedValue({ id: 'tok-1' });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'scholar@example.com', password: 'Password123!', device: 'Pixel 9' }),
      });

      const res = await mobileLoginPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.message).toBe('Login successful');
      expect(data.tokenType).toBe('Bearer');
      expect(data.expiresIn).toBe(900); // 15 mins
      expect(typeof data.accessToken).toBe('string');
      expect(typeof data.refreshToken).toBe('string');
      expect(data.user.id).toBe('u-verified-1');

      // Verify access token can be decoded
      const decoded = await decode({ token: data.accessToken, secret: TEST_SECRET });
      expect(decoded?.id).toBe('u-verified-1');
      expect(decoded?.email).toBe('scholar@example.com');
    });

    it('restores account scheduled for deletion within 30 days', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-restored',
        name: 'Restored Scholar',
        email: 'restored@example.com',
        password: '$2a$12$hashedPassword',
        isVerified: true,
        isMarkedForDeletion: true,
        deletionRequestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      ((prisma as any).mobileRefreshToken.create as jest.Mock).mockResolvedValue({ id: 'tok-1' });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'restored@example.com', password: 'Password123!' }),
      });

      const res = await mobileLoginPOST(req);
      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-restored' },
          data: { isMarkedForDeletion: false, deletionRequestedAt: null },
        })
      );
    });
  });

  describe('POST /api/mobile/v1/auth/register', () => {
    it('creates user and dispatches 6-digit OTP', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedPasswordNew');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u-new-1',
        name: 'New Scholar',
        email: 'newscholar@example.com',
        isVerified: false,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Scholar',
          email: 'newscholar@example.com',
          password: 'SecurePassword123!',
          targetExam: 'UPSC Civil Services',
        }),
      });

      const res = await mobileRegisterPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.message).toContain('OTP sent');
      expect(data.email).toBe('newscholar@example.com');
    });

    it('rejects duplicate email registration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Scholar',
          email: 'existing@example.com',
          password: 'SecurePassword123!',
        }),
      });

      const res = await mobileRegisterPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe('An account with this email already exists');
    });
  });

  describe('POST /api/mobile/v1/auth/refresh', () => {
    it('rotates refresh token and issues new token pair', async () => {
      const rawOldToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const oldTokenHash = hashRefreshToken(rawOldToken);

      ((prisma as any).mobileRefreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'tok-old',
        tokenHash: oldTokenHash,
        userId: 'u-refresh-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Valid for 10 more days
        device: 'Pixel 9',
        user: {
          id: 'u-refresh-1',
          name: 'Refreshing Scholar',
          email: 'refresh@example.com',
          image: null,
        },
      });

      ((prisma as any).mobileRefreshToken.update as jest.Mock).mockResolvedValue({});
      ((prisma as any).mobileRefreshToken.create as jest.Mock).mockResolvedValue({ id: 'tok-new' });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rawOldToken }),
      });

      const res = await mobileRefreshPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.message).toBe('Token refreshed successfully');
      expect(typeof data.accessToken).toBe('string');
      expect(typeof data.refreshToken).toBe('string');
      expect(data.refreshToken).not.toBe(rawOldToken); // Must rotate to new token!
      expect(data.user.id).toBe('u-refresh-1');

      // Verify old token was revoked
      expect((prisma as any).mobileRefreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tok-old' },
          data: { revoked: true },
        })
      );
    });

    it('rejects revoked refresh token reuse and revokes all user sessions', async () => {
      const rawCompromisedToken = 'compromised_token_1234567890abcdef1234567890abcdef';
      const tokenHash = hashRefreshToken(rawCompromisedToken);

      ((prisma as any).mobileRefreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'tok-revoked',
        tokenHash,
        userId: 'u-compromised-1',
        revoked: true, // Already revoked!
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rawCompromisedToken }),
      });

      const res = await mobileRefreshPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('REFRESH_TOKEN_INVALID');

      // Safeguard: all sessions for that user invalidated
      expect((prisma as any).mobileRefreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u-compromised-1' },
          data: { revoked: true },
        })
      );
    });
  });

  describe('POST /api/mobile/v1/auth/logout', () => {
    it('revokes refresh token on sign out', async () => {
      const rawToken = 'logout_token_hex_value_123';
      const req = new Request('http://localhost:3000/api/mobile/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rawToken }),
      });

      const res = await mobileLogoutPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Signed out successfully');

      expect((prisma as any).mobileRefreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashRefreshToken(rawToken) },
          data: { revoked: true },
        })
      );
    });
  });
});
