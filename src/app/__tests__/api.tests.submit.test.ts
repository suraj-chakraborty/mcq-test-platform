import { POST as submitPOST } from '../api/tests/[id]/submit/route';
import { POST as auditPOST } from '../api/questions/[id]/audit/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/gamification', () => ({
  processGamification: jest.fn().mockResolvedValue({
    xpEarned: 50,
    leveledUp: false,
    newLevel: 1,
    newStreak: 1,
    unlockedAchievements: [],
  }),
}));

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findUnique: jest.fn(),
    },
    testAttempt: {
      create: jest.fn(),
    },
    questionAudit: {
      create: jest.fn(),
    },
  },
}));

describe('Test Submission & Question Audit API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/tests/[id]/submit', () => {
    it('calculates score accurately and stores test attempt', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const mockQuestions = [
        { id: 'q1', question: 'What is 2+2?', options: ['2', '4', '6'], correctAnswer: 1 },
        { id: 'q2', question: 'What is capital of France?', options: ['Rome', 'Berlin', 'Paris'], correctAnswer: 2 },
      ];

      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'test_123',
        title: 'Math & GK',
        questions: mockQuestions,
      });

      (prisma.testAttempt.create as jest.Mock).mockResolvedValue({
        id: 'attempt_999',
        score: 2,
        answers: [1, 2],
        completedAt: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/tests/test_123/submit', {
        method: 'POST',
        body: JSON.stringify({
          testId: 'test_123',
          answers: [1, 2], // Both correct
        }),
      });

      const res = await submitPOST(req, { params: Promise.resolve({ id: 'test_123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.attempt.score).toBe(2);
      expect(data.attempt.percentage).toBe(100);
      expect(prisma.testAttempt.create).toHaveBeenCalled();
    });

    it('returns 404 when test is not found', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/tests/nonexistent/submit', {
        method: 'POST',
        body: JSON.stringify({
          testId: 'nonexistent',
          answers: [0],
        }),
      });

      const res = await submitPOST(req, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/questions/[id]/audit', () => {
    it('creates an audit report for a question', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.questionAudit.create as jest.Mock).mockResolvedValue({
        id: 'audit_1',
        questionId: 'q1',
        userId: 'u1',
        reason: 'INCORRECT_ANSWER',
        status: 'PENDING',
      });

      const req = new Request('http://localhost:3000/api/questions/q1/audit', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'INCORRECT_ANSWER',
          details: 'Option B is outdated.',
        }),
      });

      const res = await auditPOST(req, { params: Promise.resolve({ id: 'q1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.questionAudit.create).toHaveBeenCalled();
    });

    it('returns 400 if reason is missing', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const req = new Request('http://localhost:3000/api/questions/q1/audit', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await auditPOST(req, { params: Promise.resolve({ id: 'q1' }) });
      expect(res.status).toBe(400);
    });
  });
});
