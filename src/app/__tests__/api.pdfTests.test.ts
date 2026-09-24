import { GET as getPdfTests } from '../api/pdf-tests/route';
import { GET as getSinglePdfTest, DELETE as deletePdfTest } from '../api/pdf-tests/[id]/route';
import { POST as postAttempt } from '../api/pdf-tests/attempt/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/gamification', () => ({
  processGamification: jest.fn().mockResolvedValue({
    xpEarned: 100,
    leveledUp: false,
    newLevel: 1,
    newStreak: 1,
    unlockedAchievements: [],
  }),
}));
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    testAttempt: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('PDF Tests API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pdf-tests', () => {
    it('returns paginated list of PDF tests for user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findMany as jest.Mock).mockResolvedValue([
        { id: 'pdf_test_1', title: 'Biology Notes', pdfs: [{ id: 'pdf1' }], questions: [] },
      ]);
      (prisma.test.count as jest.Mock).mockResolvedValue(1);

      const req = new Request('http://localhost:3000/api/pdf-tests?page=1&limit=10');
      const res = await getPdfTests(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tests).toHaveLength(1);
    });
  });

  describe('GET /api/pdf-tests/[id] - Exam Integrity', () => {
    const mockTestWithAnswers = {
      id: 'pdf_test_1',
      title: 'Biology Notes',
      userId: 'u1',
      questions: [
        {
          id: 'q1',
          question: 'What is mitochondria?',
          options: ['Powerhouse of cell', 'Control center'],
          correctAnswer: 0,
          explanation: 'It produces ATP.',
          proofQuote: 'Mitochondria generates most chemical energy',
          pageReference: 'Page 12, Paragraph 2',
        },
      ],
    };

    it('strips correctAnswer, explanation, and proofQuote before submission', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTestWithAnswers);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(null); // Not submitted yet

      const req = new Request('http://localhost:3000/api/pdf-tests/pdf_test_1');
      const res = await getSinglePdfTest(req, { params: Promise.resolve({ id: 'pdf_test_1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isSubmitted).toBe(false);
      // Integrity checks: answers must NOT be leaked
      expect(data.test.questions[0].correctAnswer).toBeUndefined();
      expect(data.test.questions[0].explanation).toBeUndefined();
      expect(data.test.questions[0].proofQuote).toBeUndefined();
      // Question content and pageReference remain intact
      expect(data.test.questions[0].question).toBe('What is mitochondria?');
      expect(data.test.questions[0].options).toHaveLength(2);
      expect(data.test.questions[0].pageReference).toBe('Page 12, Paragraph 2');
    });

    it('reveals correctAnswer, explanation, and proofQuote after submission', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTestWithAnswers);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'attempt_1',
        completed: true,
      }); // Completed submission exists

      const req = new Request('http://localhost:3000/api/pdf-tests/pdf_test_1');
      const res = await getSinglePdfTest(req, { params: Promise.resolve({ id: 'pdf_test_1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isSubmitted).toBe(true);
      // Answers revealed for review
      expect(data.test.questions[0].correctAnswer).toBe(0);
      expect(data.test.questions[0].explanation).toBe('It produces ATP.');
      expect(data.test.questions[0].proofQuote).toContain('Mitochondria generates');
    });
  });

  describe('POST /api/pdf-tests/attempt', () => {
    it('grades answers server-side and reveals answers only in post-submit response', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const mockQuestions = [
        {
          id: 'q1',
          question: 'What is mitochondria?',
          options: ['Powerhouse of cell', 'Control center'],
          correctAnswer: 0,
          explanation: 'It produces ATP.',
          proofQuote: 'Mitochondria generates most chemical energy',
        },
      ];

      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_test_1',
        userId: 'u1',
        questions: mockQuestions,
      });

      (prisma.testAttempt.create as jest.Mock).mockResolvedValue({
        id: 'att_123',
        userId: 'u1',
        testId: 'pdf_test_1',
        score: 1,
        answers: [0],
        completed: true,
      });

      const req = new Request('http://localhost:3000/api/pdf-tests/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: 'pdf_test_1',
          answers: [0],
        }),
      });

      const res = await postAttempt(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.score).toBe(1);
      expect(data.percentage).toBe(100);
      // Graded questions revealed with answers & explanations
      expect(data.questions).toBeDefined();
      expect(data.questions[0].correctAnswer).toBe(0);
      expect(data.questions[0].isCorrect).toBe(true);
      expect(data.questions[0].explanation).toBe('It produces ATP.');
      expect(data.questions[0].proofQuote).toContain('Mitochondria generates');
    });
  });

  describe('DELETE /api/pdf-tests/[id]', () => {
    it('deletes user PDF test successfully', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'pdf_test_1',
        userId: 'u1',
      });
      (prisma.test.delete as jest.Mock).mockResolvedValue({ id: 'pdf_test_1' });

      const req = new Request('http://localhost:3000/api/pdf-tests/pdf_test_1', { method: 'DELETE' });
      const res = await deletePdfTest(req, { params: Promise.resolve({ id: 'pdf_test_1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.test.delete).toHaveBeenCalled();
    });
  });
});
