import { acquireIdempotencyLock, releaseIdempotencyLock } from '@/app/lib/idempotency';
import { processGamification } from '@/app/lib/gamification';
import { POST as submitAttemptPOST } from '@/app/api/tests/[id]/submit/route';
import { POST as pdfAttemptPOST } from '@/app/api/pdf-tests/attempt/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findUnique: jest.fn(),
    },
    testAttempt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return Promise.all(cb);
    }),
  },
}));

describe('Idempotency & Replay Protection (Step 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Concurrent Double-Submit Protection', () => {
    it('returns 409 CONCURRENT_SUBMISSION when a submit lock is already held', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const testId = 'test_lock_123';
      const key = `fp:${testId}`;

      // Acquire lock manually to simulate concurrent in-flight request
      await acquireIdempotencyLock(key, 60000);

      // Submit with that same key in headers
      const req = new Request(`http://localhost:3000/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': key,
        },
        body: JSON.stringify({
          testId,
          answers: [0, 1],
        }),
      });

      const res = await submitAttemptPOST(req, { params: Promise.resolve({ id: testId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('CONCURRENT_SUBMISSION');

      // Release lock
      await releaseIdempotencyLock(key);
    });

    it('returns 409 CONCURRENT_SUBMISSION on pdf-tests/attempt when lock is held', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const testId = 'pdf_test_lock_456';
      const key = `pdf_lock_${testId}`;

      await acquireIdempotencyLock(key, 60000);

      const req = new Request('http://localhost:3000/api/pdf-tests/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': key,
        },
        body: JSON.stringify({
          testId,
          answers: [0, 1],
        }),
      });

      const res = await pdfAttemptPOST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('CONCURRENT_SUBMISSION');

      await releaseIdempotencyLock(key);
    });
  });

  describe('Duplicate Replay Protection within Deduplication Window', () => {
    it('returns existing attempt on duplicate submit without re-creating attempt record', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'test_rep_1',
        title: 'Sample Test',
        questions: [{ question: 'Q1', options: ['A', 'B'], correctAnswer: 0 }],
      });

      // Existing recent attempt submitted 2 seconds ago
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'attempt_existing_99',
        userId: 'u1',
        testId: 'test_rep_1',
        score: 1,
        completed: true,
        completedAt: new Date(Date.now() - 2000),
      });

      const req = new Request('http://localhost:3000/api/tests/test_rep_1/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: 'test_rep_1',
          answers: [0],
        }),
      });

      const res = await submitAttemptPOST(req, { params: Promise.resolve({ id: 'test_rep_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.isDuplicate).toBe(true);
      expect(data.attempt.id).toBe('attempt_existing_99');
      // prisma.testAttempt.create MUST NOT be called again
      expect(prisma.testAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('processGamification Replay Defense (No Double XP)', () => {
    it('prevents double-counting XP and streak when attemptId already has awarded XP', async () => {
      // User with 100 XP
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_gamer_1',
        xp: 100,
        level: 1,
        streak: 3,
        achievements: [],
      });

      // Attempt that was already awarded 50 XP
      (prisma.testAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'attempt_already_rewarded',
        xpEarned: 50,
      });

      const result = await processGamification(
        'user_gamer_1',
        5,
        5,
        60,
        'attempt_already_rewarded'
      );

      expect(result).toBeDefined();
      expect(result?.isDuplicate).toBe(true);
      expect(result?.xpEarned).toBe(0);

      // Verify that tx.user.update was NEVER called to increment XP
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
