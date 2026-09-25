import { createApiErrorResponse, maskSensitiveData } from '@/app/lib/apiError';
import { PUT as updateUser } from '../api/users/update/route';
import { POST as startTest } from '../api/tests/start/route';
import { POST as uploadPdf } from '../api/upload/route';
import { POST as verifyAi } from '../api/settings/verify-ai/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    test: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/app/lib/ai');
jest.mock('@/app/lib/rateLimiter', () => ({
  RateLimiterService: jest.fn().mockImplementation(() => ({
    checkLimit: jest.fn().mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 }),
    isConfigured: () => true,
  })),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
jest.mock('@/app/lib/idempotency', () => ({
  acquireIdempotencyLock: jest.fn().mockResolvedValue({ acquired: true }),
  releaseIdempotencyLock: jest.fn().mockResolvedValue(undefined),
  getIdempotentResponse: jest.fn().mockResolvedValue(null),
  storeIdempotentResponse: jest.fn().mockResolvedValue(undefined),
}));

describe('Step 8: Error Hygiene, PII Masking & Information Disclosure Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PII and Credential Masking Utility (maskSensitiveData)', () => {
    it('masks email addresses from error logs', () => {
      const raw = 'Failed to send notification to user.admin@domain.co.uk due to timeout';
      const masked = maskSensitiveData(raw);
      expect(masked).not.toContain('user.admin@domain.co.uk');
      expect(masked).toContain('[REDACTED_EMAIL]');
    });

    it('masks secrets, tokens, API keys, and passwords', () => {
      const raw = 'Auth failure: password=superSecretPassword123 with apiKey=sk_live_99887766';
      const masked = maskSensitiveData(raw);
      expect(masked).not.toContain('superSecretPassword123');
      expect(masked).not.toContain('sk_live_99887766');
      expect(masked).toContain('password=[REDACTED]');
      expect(masked).toContain('apiKey=[REDACTED]');
    });

    it('masks raw MongoDB Atlas connection strings', () => {
      const raw = 'Failed to connect to mongodb+srv://admin:secretPass@cluster0.mongodb.net/prod?retryWrites=true';
      const masked = maskSensitiveData(raw);
      expect(masked).not.toContain('secretPass');
      expect(masked).not.toContain('cluster0.mongodb.net');
      expect(masked).toContain('mongodb://[REDACTED_URI]');
    });
  });

  describe('Standardized Error Response Helper (createApiErrorResponse)', () => {
    it('returns structured envelope with error, code, message, and requestId', () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { 'x-request-id': 'req-abc-123' },
      });

      const res = createApiErrorResponse(
        400,
        'INVALID_PAYLOAD',
        'The provided payload failed schema validation.',
        new Error('Detailed driver failure with sensitive info'),
        req
      );

      expect(res.status).toBe(400);
      return res.json().then((data) => {
        expect(data.error).toBe('The provided payload failed schema validation.');
        expect(data.code).toBe('INVALID_PAYLOAD');
        expect(data.requestId).toBe('req-abc-123');
        expect(data.errorDetails).toEqual({
          code: 'INVALID_PAYLOAD',
          message: 'The provided payload failed schema validation.',
          requestId: 'req-abc-123',
        });
      });
    });

    it('generates a fallback UUID when x-request-id is omitted', () => {
      const res = createApiErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
      expect(res.status).toBe(500);
      return res.json().then((data) => {
        expect(typeof data.requestId).toBe('string');
        expect(data.requestId.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Forced Error Simulations: Zero Internal Path or Stack Leaks (SEC-013)', () => {
    it('PUT /api/users/update suppresses internal Prisma database driver exceptions', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', email: 'test@example.com' });
      (prisma.user.update as jest.Mock).mockRejectedValue(
        new Error('PrismaClientKnownRequestError: Invalid column `/var/www/internal/models/user.prisma` line 42')
      );

      const req = new Request('http://localhost:3000/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const res = await updateUser(req);
      expect(res.status).toBe(500);
      const data = await res.json();

      expect(data.error).toBe('Internal server error');
      expect(data.error).not.toContain('PrismaClientKnownRequestError');
      expect(data.error).not.toContain('/var/www/');
    });

    it('POST /api/tests/start suppresses AI SDK stack trace leaks', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const { generateKnowledgeMCQs } = require('@/app/lib/ai');
      (generateKnowledgeMCQs as jest.Mock).mockRejectedValue(
        new Error('GeminiSDKInternalError: Connection reset at /node_modules/@google/genai/dist/index.js:512')
      );

      const req = new Request('http://localhost:3000/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'current-affairs',
          count: 5,
        }),
      });

      const res = await startTest(req);
      expect(res.status).toBe(500);
      const data = await res.json();

      expect(data.error).toBe('Internal server error');
      expect(data.error).not.toContain('GeminiSDKInternalError');
      expect(data.error).not.toContain('node_modules');
    });

    it('POST /api/upload suppresses internal file processing errors', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('EACCES: permission denied, open /var/storage/temp/pdf_buffer_123.bin')
      );

      const req = new Request('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl: 'https://res.cloudinary.com/test_cloud/raw/upload/test.pdf',
          title: 'Sample PDF',
        }),
      });

      const res = await uploadPdf(req);
      expect(res.status).toBe(500);
      const data = await res.json();

      expect(data.error).toBe('Internal server error');
      expect(data.error).not.toContain('EACCES');
      expect(data.error).not.toContain('/var/storage/');
    });

    it('POST /api/settings/verify-ai returns safe error message on internal provider failure', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', email: 'test@example.com' } });
      (getGenAIInstance as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn().mockRejectedValue(
            new Error('RPC_FAILED: socket closed unexpectedly by remote 10.0.1.25:443')
          ),
        },
      });

      const req = new Request('http://localhost:3000/api/settings/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'default' }),
      });

      const res = await verifyAi(req as any);
      expect(res.status).toBe(500);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to connect to AI provider');
      expect(data.error).not.toContain('RPC_FAILED');
      expect(data.error).not.toContain('10.0.1.25');
    });
  });
});
