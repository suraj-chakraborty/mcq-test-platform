import { POST as loginPOST } from '../api/auth/login/route';
import { POST as registerPOST } from '../api/auth/register/route';
import { DELETE as deletePdf } from '../api/pdfs/[id]/route';
import { POST as auditQuestion } from '../api/questions/[id]/audit/route';
import { POST as joinDuel } from '../api/duels/join/route';
import { POST as signCloudinary } from '../api/cloudinary/sign/route';
import { getServerSession } from 'next-auth';
import { decode } from 'next-auth/jwt';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { RateLimiterService } from '@/app/lib/rateLimiter';

jest.mock('next-auth');
jest.mock('bcryptjs');
jest.mock('@/app/lib/send-mail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pdfDocument: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
    },
    questionAudit: {
      create: jest.fn(),
    },
    duelRoom: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn().mockReturnValue('mocked_cloudinary_signature_xyz'),
    },
  },
}));

describe('Step 6: Mobile JWT Auth, IDOR Remediation & Least Privilege Tests', () => {
  const TEST_SECRET = 'test_nextauth_secret_key_minimum_32_chars_long!';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_api_key';
    process.env.CLOUDINARY_API_SECRET = 'test_api_secret';
  });

  describe('Mobile JWT Authentication (/api/auth/login)', () => {
    it('returns 400 for invalid email format or missing password', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email', password: '' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('returns 401 with generic error message if user does not exist (SEC-017)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unknown@example.com', password: 'Password123!' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('Invalid email or password');
    });

    it('returns 401 with generic error message if password does not match (SEC-017)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        password: '$2a$12$hashedPasswordExample',
        isVerified: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'WrongPassword' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toBe('Invalid email or password');
    });

    it('returns 403 if email is not verified', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'unverified@example.com',
        password: '$2a$12$hashedPasswordExample',
        isVerified: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unverified@example.com', password: 'Password123!' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toContain('verify your email');
    });

    it('issues a signed NextAuth-compatible JWT token on valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u_valid_123',
        name: 'Mobile User',
        email: 'mobile@example.com',
        password: '$2a$12$hashedPasswordExample',
        image: 'https://res.cloudinary.com/avatar.png',
        isVerified: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mobile@example.com', password: 'ValidPassword123' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.message).toBe('User logged in successfully');
      expect(data.tokenType).toBe('Bearer');
      expect(typeof data.accessToken).toBe('string');
      expect(data.user.id).toBe('u_valid_123');

      // Verify the JWT token can be decrypted and decoded with NextAuth JWT
      const decoded = await decode({
        token: data.accessToken,
        secret: TEST_SECRET,
      });

      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe('u_valid_123');
      expect(decoded?.email).toBe('mobile@example.com');
      expect(decoded?.name).toBe('Mobile User');
    });

    it('handles account deletion grace period restoration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u_marked_1',
        name: 'Restored User',
        email: 'restore@example.com',
        password: '$2a$12$hashedPasswordExample',
        isVerified: true,
        isMarkedForDeletion: true,
        deletionRequestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (< 30 days)
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'restore@example.com', password: 'ValidPassword123' }),
      });

      const res = await loginPOST(req);
      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u_marked_1' },
          data: { isMarkedForDeletion: false, deletionRequestedAt: null },
        })
      );
    });
  });

  describe('PRNG OTP Generation (/api/auth/register SEC-006)', () => {
    it('creates user with a 6-digit numeric string OTP using crypto.randomInt', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      (prisma.user.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'new_u', ...data }));

      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Crypto User',
          email: 'crypto@example.com',
          password: 'Password123!',
        }),
      });

      const res = await registerPOST(req);
      expect(res.status).toBe(201);

      const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
      const generatedOtp = createCall.data.otp;

      expect(typeof generatedOtp).toBe('string');
      expect(generatedOtp).toMatch(/^[1-9][0-9]{5}$/); // 6-digit number between 100000 and 999999
    });
  });

  describe('IDOR & Access Control: PDF Document Deletion (/api/pdfs/[id])', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/pdfs/pdf123', { method: 'DELETE' });
      const res = await deletePdf(req, { params: Promise.resolve({ id: 'pdf123' }) });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid ID format (preventing NoSQL injection)', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user_1' } });

      const req = new Request('http://localhost:3000/api/pdfs/invalid$id', { method: 'DELETE' });
      const res = await deletePdf(req, { params: Promise.resolve({ id: 'invalid$id' }) });
      expect(res.status).toBe(400);
    });

    it('returns 404 (IDOR prevention) when PDF belongs to a test owned by another user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'victim_user' } });
      (prisma.pdfDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_target',
        name: 'other_user_doc.pdf',
        test: {
          id: 'test_other',
          userId: 'attacker_user', // different owner
        },
      });

      const req = new Request('http://localhost:3000/api/pdfs/pdf_target', { method: 'DELETE' });
      const res = await deletePdf(req, { params: Promise.resolve({ id: 'pdf_target' }) });
      expect(res.status).toBe(404);
      expect(prisma.pdfDocument.delete).not.toHaveBeenCalled();
    });

    it('deletes successfully when PDF belongs to the authenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'authorized_user' } });
      (prisma.pdfDocument.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_own',
        name: 'my_doc.pdf',
        test: {
          id: 'test_own',
          userId: 'authorized_user',
        },
      });
      (prisma.pdfDocument.delete as jest.Mock).mockResolvedValue({ id: 'pdf_own' });

      const req = new Request('http://localhost:3000/api/pdfs/pdf_own', { method: 'DELETE' });
      const res = await deletePdf(req, { params: Promise.resolve({ id: 'pdf_own' }) });
      expect(res.status).toBe(200);
      expect(prisma.pdfDocument.delete).toHaveBeenCalledWith({ where: { id: 'pdf_own' } });
    });
  });

  describe('IDOR & Input Verification: Question Audit (/api/questions/[id]/audit SEC-016)', () => {
    it('returns 404 if question does not exist', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.question.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/questions/q_missing/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Question has incorrect answer' }),
      });

      const res = await auditQuestion(req, { params: Promise.resolve({ id: 'q_missing' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Question not found');
    });

    it('creates audit record successfully if question exists', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({ id: 'q_exists_123' });
      (prisma.questionAudit.create as jest.Mock).mockResolvedValue({
        id: 'audit_1',
        questionId: 'q_exists_123',
        userId: 'u1',
        reason: 'Typo in option B',
      });

      const req = new Request('http://localhost:3000/api/questions/q_exists_123/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Typo in option B' }),
      });

      const res = await auditQuestion(req, { params: Promise.resolve({ id: 'q_exists_123' }) });
      expect(res.status).toBe(200);
      expect(prisma.questionAudit.create).toHaveBeenCalled();
    });
  });

  describe('Duel Atomic Join Race Condition Defense (/api/duels/join SEC-024)', () => {
    it('returns 409 if atomic updateMany finds 0 available waiting slots', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'second_guest' } });
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue({
        id: 'room_racing',
        roomCode: 'RACE12',
        hostId: 'host_player',
        status: 'WAITING',
      });
      // Simulate another guest winning the atomic race right before this update
      (prisma.duelRoom.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const req = new Request('http://localhost:3000/api/duels/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: 'RACE12' }),
      });

      const res = await joinDuel(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Room is already full or battle started');
    });
  });

  describe('Cloudinary Signing Parameter Hardening (/api/cloudinary/sign SEC-012)', () => {
    it('rejects unauthorized folder values with 400', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const req = new Request('http://localhost:3000/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'system_secrets' }),
      });

      const res = await signCloudinary(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid signing parameters');
    });

    it('rejects unexpected properties with 400 (.strict() schema enforcement)', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const req = new Request('http://localhost:3000/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'avatars', maliciousParam: 'inject' }),
      });

      const res = await signCloudinary(req);
      expect(res.status).toBe(400);
    });
  });
});
