import { GET, POST } from '../api/flashcards/route';
import { POST as reviewPOST } from '../api/flashcards/[id]/review/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    flashcard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    test: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Flashcards API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/flashcards', () => {
    it('returns 401 when unauthenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns due flashcards for authenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const mockCards = [
        { id: 'fc1', questionId: 'q1', interval: 1, repetition: 1, question: { question: 'What is photosynthesis?' } }
      ];
      (prisma.flashcard.findMany as jest.Mock).mockResolvedValue(mockCards);

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.flashcards).toHaveLength(1);
    });
  });

  describe('POST /api/flashcards', () => {
    it('creates flashcards from test questions', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 't1',
        questions: [{ id: 'q1' }, { id: 'q2' }],
      });
      (prisma.flashcard.upsert as jest.Mock).mockResolvedValue({ id: 'fc1' });

      const req = new Request('http://localhost:3000/api/flashcards', {
        method: 'POST',
        body: JSON.stringify({ testId: 't1' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });

    it('returns 400 when testId is missing', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const req = new Request('http://localhost:3000/api/flashcards', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/flashcards/[id]/review', () => {
    it('reviews a flashcard and updates SM-2 schedule', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.flashcard.findUnique as jest.Mock).mockResolvedValue({
        id: 'fc1',
        userId: 'u1',
        interval: 1,
        repetition: 1,
        easeFactor: 2.5,
        nextReviewAt: new Date(),
      });
      (prisma.flashcard.update as jest.Mock).mockResolvedValue({
        id: 'fc1',
        interval: 6,
        repetition: 2,
        easeFactor: 2.6,
      });

      const req = new Request('http://localhost:3000/api/flashcards/fc1/review', {
        method: 'POST',
        body: JSON.stringify({ quality: 5 }),
      });

      const res = await reviewPOST(req, { params: Promise.resolve({ id: 'fc1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.flashcard.repetition).toBe(2);
    });

    it('returns 404 if flashcard does not exist or belongs to another user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.flashcard.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/flashcards/invalid/review', {
        method: 'POST',
        body: JSON.stringify({ quality: 4 }),
      });

      const res = await reviewPOST(req, { params: Promise.resolve({ id: 'invalid' }) });
      expect(res.status).toBe(404);
    });
  });
});
