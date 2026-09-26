import { GET as mobileFlashcardsGET, POST as mobileFlashcardsPOST } from '../api/mobile/v1/flashcards/route';
import { POST as mobileFlashcardReviewPOST } from '../api/mobile/v1/flashcards/[id]/review/route';
import { prisma } from '@/app/lib/prisma';
import { encode } from 'next-auth/jwt';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    test: {
      findUnique: jest.fn(),
    },
    testAttempt: {
      findFirst: jest.fn(),
    },
    flashcard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Phase 5: Mobile v1 Flashcards & SRS / SM-2 Algorithm Endpoints', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';
  let validBearerToken: string;

  const mockUser = {
    id: 'u-scholar-123',
    name: 'Mobile Scholar',
    email: 'scholar@example.com',
  };

  const mockQuestion = {
    id: 'q-const-1',
    question: 'Which Article of the Constitution guarantees Right to Equality before Law?',
    options: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
    correctAnswer: 0,
    explanation: 'Article 14 guarantees equality before law and equal protection of laws.',
    proofQuote: 'Constitution of India, Art. 14',
    pageReference: 'Page 8',
    citationType: 'VERBATIM_PROOF',
    difficulty: 'easy',
  };

  const mockFlashcard = {
    id: 'fc-101',
    userId: mockUser.id,
    questionId: mockQuestion.id,
    interval: 1,
    repetition: 1,
    easeFactor: 2.5,
    nextReviewAt: new Date(Date.now() - 3600000), // Due 1 hour ago
    question: mockQuestion,
  };

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    validBearerToken = await encode({
      token: {
        id: mockUser.id,
        sub: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
      },
      secret: TEST_SECRET,
      maxAge: 900,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
  });

  describe('1. GET /api/mobile/v1/flashcards', () => {
    it('returns 401 when no auth is provided', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards');
      const res = await mobileFlashcardsGET(req);
      expect(res.status).toBe(401);
    });

    it('returns due flashcards formatted with front, back and metadata', async () => {
      (prisma.flashcard.findMany as jest.Mock).mockResolvedValue([mockFlashcard]);
      (prisma.flashcard.count as jest.Mock)
        .mockResolvedValueOnce(1) // dueCount
        .mockResolvedValueOnce(10); // totalCount

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards?page=1&limit=20', {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileFlashcardsGET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.flashcards).toHaveLength(1);
      expect(data.flashcards[0].id).toBe('fc-101');
      expect(data.flashcards[0].front).toContain('Right to Equality');
      expect(data.flashcards[0].back).toBe('Article 14');
      expect(data.flashcards[0].explanation).toContain('Article 14 guarantees');
      expect(data.dueCount).toBe(1);
      expect(data.totalCount).toBe(10);
    });
  });

  describe('2. POST /api/mobile/v1/flashcards (Deck Generation)', () => {
    it('returns 404 if test does not exist', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testId: 'missing-test' }),
      });

      const res = await mobileFlashcardsPOST(req);
      expect(res.status).toBe(404);
    });

    it('returns 403 if user does not own the test and has not completed it', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'other-user-test',
        userId: 'other-user-id',
        title: 'Secret Exam Test',
        questions: [mockQuestion],
      });
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testId: 'other-user-test' }),
      });

      const res = await mobileFlashcardsPOST(req);
      expect(res.status).toBe(403);
    });

    it('successfully generates flashcard deck from completed test', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-completed-101',
        userId: 'other-user-id',
        title: 'Polity Drill',
        questions: [mockQuestion],
      });
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'attempt-ok',
        completed: true,
      });
      (prisma.flashcard.upsert as jest.Mock).mockResolvedValue(mockFlashcard);

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testId: 'test-completed-101' }),
      });

      const res = await mobileFlashcardsPOST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deckSize).toBe(1);
      expect(data.testTitle).toBe('Polity Drill');
    });
  });

  describe('3. POST /api/mobile/v1/flashcards/[id]/review (SM-2 Algorithm)', () => {
    it('validates quality score range 0-5', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards/fc-101/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quality: 9 }), // Invalid (> 5)
      });

      const res = await mobileFlashcardReviewPOST(req, {
        params: Promise.resolve({ id: 'fc-101' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 if flashcard is not owned by user', async () => {
      (prisma.flashcard.findUnique as jest.Mock).mockResolvedValue({
        ...mockFlashcard,
        userId: 'other-user-id',
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards/fc-101/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quality: 4 }),
      });

      const res = await mobileFlashcardReviewPOST(req, {
        params: Promise.resolve({ id: 'fc-101' }),
      });
      expect(res.status).toBe(404);
    });

    it('calculates SM-2 interval expansion for Good rating (quality = 4) and awards XP', async () => {
      (prisma.flashcard.findUnique as jest.Mock).mockResolvedValue(mockFlashcard);
      (prisma.flashcard.update as jest.Mock).mockImplementation(({ data }) => ({
        ...mockFlashcard,
        ...data,
      }));

      const req = new Request('http://localhost:3000/api/mobile/v1/flashcards/fc-101/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quality: 4 }), // Good rating
      });

      const res = await mobileFlashcardReviewPOST(req, {
        params: Promise.resolve({ id: 'fc-101' }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.flashcard.repetition).toBe(2);
      expect(data.flashcard.interval).toBeGreaterThanOrEqual(1);
      expect(data.flashcard.xpAwarded).toBe(5);
    });
  });
});
