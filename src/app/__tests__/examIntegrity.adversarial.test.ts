import { GET as getTest } from '../api/tests/[id]/route';
import { GET as getPdfTest } from '../api/pdf-tests/[id]/route';
import { GET as getStartTest } from '../api/tests/[id]/start/route';
import { POST as submitAnswer } from '../api/tests/[id]/answer/route';
import { POST as createFlashcards } from '../api/flashcards/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    testAttempt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    flashcard: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('Exam Integrity & Anti-Cheating Adversarial Tests', () => {
  const mockTest = {
    id: 'test_exam_99',
    userId: 'legit_user_1',
    title: 'Biochemistry Final Exam',
    duration: 60,
    questions: [
      {
        id: 'q1',
        question: 'What is the primary function of ATP synthase?',
        options: ['Phosphorylation', 'Glycolysis', 'Krebs', 'Fermentation'],
        correctAnswer: 0,
        explanation: 'ATP synthase synthesizes ATP from ADP and inorganic phosphate.',
        proofQuote: 'ATP synthase catalyzes the formation of ATP using electrochemical proton gradients.',
      },
      {
        id: 'q2',
        question: 'Which cofactor is essential for transketolase?',
        options: ['NADPH', 'TPP', 'FAD', 'Biotin'],
        correctAnswer: 1,
        explanation: 'Thiamine pyrophosphate (TPP) is the essential prosthetic group.',
        proofQuote: 'Transketolase requires thiamine pyrophosphate as a cofactor.',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('(a) Partial / In-Progress Attempt Answer Secrecy', () => {
    it('answers remain strictly hidden after submitting an empty or partial attempt', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'legit_user_1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);

      // Latest attempt in DB is in-progress (partial: completed = false)
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'att_partial',
        userId: 'legit_user_1',
        testId: 'test_exam_99',
        completed: false,
        score: 1,
        answers: [0, -1],
      });

      const req = new Request('http://localhost:3000/api/tests/test_exam_99');
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await getTest(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isSubmitted).toBe(false);

      // Verify every question has stripped answers
      data.test.questions.forEach((q: any) => {
        expect(q.correctAnswer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.proofQuote).toBeUndefined();
      });
    });

    it('in-progress answer submission route does NOT leak answers or disclose score', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'legit_user_1' } });
      (prisma.testAttempt.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'att_in_progress',
        userId: 'legit_user_1',
        testId: 'test_exam_99',
        answers: [-1, -1],
        completed: false,
        score: 0,
        test: mockTest,
      });
      (prisma.testAttempt.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'att_in_progress',
          ...data,
        })
      );

      // Answering question 0
      const req = new Request('http://localhost:3000/api/tests/test_exam_99/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: 0, answer: 0 }),
      });
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await submitAnswer(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      // In-progress test must not disclose total correct/wrong score count
      expect(data.test.correctAnswers).toBeUndefined();
      expect(data.test.wrongAnswers).toBeUndefined();

      // Questions returned must not have answers
      data.test.questions.forEach((q: any) => {
        expect(q.correctAnswer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.proofQuote).toBeUndefined();
      });
    });
  });

  describe('(b) Retake Behavior', () => {
    it('answers remain hidden when a user enters retake mode despite previous completed attempt', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'legit_user_1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);

      // Previous attempt was completed, but user requests retake mode
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'att_old_completed',
        userId: 'legit_user_1',
        testId: 'test_exam_99',
        completed: true,
      });

      const req = new Request('http://localhost:3000/api/tests/test_exam_99?retake=true');
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await getTest(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isSubmitted).toBe(false);

      data.test.questions.forEach((q: any) => {
        expect(q.correctAnswer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.proofQuote).toBeUndefined();
      });
    });

    it('answers are revealed once the retake attempt is fully completed', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'legit_user_1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);

      // Normal review request after completed attempt
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'att_retake_completed',
        userId: 'legit_user_1',
        testId: 'test_exam_99',
        completed: true,
      });

      const req = new Request('http://localhost:3000/api/tests/test_exam_99');
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await getTest(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isSubmitted).toBe(true);

      // All answers and proof citations are revealed for study review
      expect(data.test.questions[0].correctAnswer).toBe(0);
      expect(data.test.questions[0].explanation).toBeDefined();
      expect(data.test.questions[0].proofQuote).toBeDefined();
    });
  });

  describe('(c) Unauthorized Access Protection (403/404)', () => {
    it('returns 404 when an unauthorized user attempts to GET another user private test', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'attacker_user_99' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest); // belongs to legit_user_1

      const req = new Request('http://localhost:3000/api/tests/test_exam_99');
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await getTest(req, { params });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toMatch(/not found/i);
    });

    it('returns 404 when an unauthorized user calls the test start route', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'attacker_user_99' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);

      const req = new Request('http://localhost:3000/api/tests/test_exam_99/start');
      const params = Promise.resolve({ id: 'test_exam_99' });
      const res = await getStartTest(req, { params });

      expect(res.status).toBe(404);
    });

    it('returns 403 when an unauthorized user tries to generate flashcards from an incomplete test', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'attacker_user_99' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(null); // No completed attempt

      const req = new Request('http://localhost:3000/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: 'test_exam_99' }),
      });
      const res = await createFlashcards(req);

      expect(res.status).toBe(403);
    });
  });
});
