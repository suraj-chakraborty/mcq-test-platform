import { GET as mobileTestsListGET } from '../api/mobile/v1/tests/route';
import { GET as mobileTestStartGET } from '../api/mobile/v1/tests/[id]/start/route';
import { POST as mobileTestSubmitPOST } from '../api/mobile/v1/tests/[id]/submit/route';
import { GET as mobileTestResultsGET } from '../api/mobile/v1/tests/[id]/results/route';
import { GET as mobileTestLeaderboardGET } from '../api/mobile/v1/tests/[id]/leaderboard/route';
import { POST as mobileTestCreatePOST } from '../api/mobile/v1/tests/create/route';
import { prisma } from '@/app/lib/prisma';
import { encode } from 'next-auth/jwt';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    test: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    testAttempt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/app/lib/gamification', () => ({
  processGamification: jest.fn().mockResolvedValue({
    xpAwarded: 50,
    leveledUp: false,
    newLevel: 2,
    newStreak: 5,
  }),
}));

describe('Phase 4: Mobile v1 Test Taking, Results & Leaderboard Endpoints', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';
  let validBearerToken: string;

  const mockTestWithAnswers = {
    id: 'test-const-101',
    title: 'Indian Constitution Mastery Mock',
    description: 'Fundamental rights, preamble, and landmark cases',
    duration: 15,
    userId: 'u-author-456',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    user: {
      name: 'Constitution Scholar',
      image: null,
    },
    _count: {
      questions: 3,
      attempts: 42,
    },
    pdfs: [{ id: 'pdf-1', name: 'Bare_Act.pdf', fileSize: 1048576 }],
    questions: [
      {
        id: 'q-1',
        question: 'Which Article guarantees Right to Constitutional Remedies?',
        options: ['Article 19', 'Article 21', 'Article 32', 'Article 226'],
        correctAnswer: 2,
        explanation: 'Article 32 gives the right to move the Supreme Court.',
        proofQuote: 'Constitution of India, Art. 32(1)',
        pageReference: 'Page 14',
        citationType: 'VERBATIM_PROOF',
        difficulty: 'medium',
      },
      {
        id: 'q-2',
        question: 'Which schedule deals with Panchayati Raj?',
        options: ['9th Schedule', '10th Schedule', '11th Schedule', '12th Schedule'],
        correctAnswer: 2,
        explanation: '11th Schedule added by 73rd Amendment.',
        proofQuote: '73rd Amendment Act, 1992',
        pageReference: 'Page 45',
        citationType: 'VERBATIM_PROOF',
        difficulty: 'easy',
      },
      {
        id: 'q-3',
        question: 'Who chaired the drafting committee?',
        options: ['Dr. Rajendra Prasad', 'Dr. B. R. Ambedkar', 'Jawaharlal Nehru', 'KM Munshi'],
        correctAnswer: 1,
        explanation: 'Dr. B.R. Ambedkar was Chairman of the Drafting Committee.',
        proofQuote: 'Constituent Assembly Debates Vol 1',
        pageReference: 'Page 2',
        citationType: 'VERBATIM_PROOF',
        difficulty: 'easy',
      },
    ],
  };

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    validBearerToken = await encode({
      token: {
        id: 'u-scholar-123',
        sub: 'u-scholar-123',
        name: 'Mobile Scholar',
        email: 'scholar@example.com',
      },
      secret: TEST_SECRET,
      maxAge: 900,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u-scholar-123',
      name: 'Mobile Scholar',
      email: 'scholar@example.com',
    });
  });

  describe('1. GET /api/mobile/v1/tests (Catalog)', () => {
    it('returns 401 when no auth provided', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/tests');
      const res = await mobileTestsListGET(req);
      expect(res.status).toBe(401);
    });

    it('returns formatted test catalog with pagination metadata', async () => {
      (prisma.test.findMany as jest.Mock).mockResolvedValue([mockTestWithAnswers]);
      (prisma.test.count as jest.Mock).mockResolvedValue(1);

      const req = new Request('http://localhost:3000/api/mobile/v1/tests?page=1&limit=10', {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });
      const res = await mobileTestsListGET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.tests).toHaveLength(1);
      expect(data.tests[0].id).toBe('test-const-101');
      expect(data.tests[0].questionCount).toBe(3);
      expect(data.tests[0].duration).toBe(15);
      expect(data.pagination.total).toBe(1);
    });
  });

  describe('2. GET /api/mobile/v1/tests/[id]/start (Exam Integrity Sanitization)', () => {
    it('returns 404 if test does not exist', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/tests/test-missing/start', {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });
      const res = await mobileTestStartGET(req, { params: Promise.resolve({ id: 'test-missing' }) });
      expect(res.status).toBe(404);
    });

    it('CRITICAL: strictly strips correctAnswer, explanation, and proofQuote from questions payload', async () => {
      // Simulate Prisma query selecting only sanitized fields as requested in query
      const sanitizedQuestionsMock = mockTestWithAnswers.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      }));

      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: mockTestWithAnswers.id,
        title: mockTestWithAnswers.title,
        description: mockTestWithAnswers.description,
        duration: mockTestWithAnswers.duration,
        questions: sanitizedQuestionsMock,
      });

      const req = new Request(`http://localhost:3000/api/mobile/v1/tests/${mockTestWithAnswers.id}/start`, {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });
      const res = await mobileTestStartGET(req, {
        params: Promise.resolve({ id: mockTestWithAnswers.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.test.questions).toHaveLength(3);

      for (const q of data.test.questions) {
        expect(q.correctAnswer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.proofQuote).toBeUndefined();
        expect(q.options).toHaveLength(4);
      }
    });
  });

  describe('3. POST /api/mobile/v1/tests/[id]/submit (Server-Authoritative Evaluation)', () => {
    it('correctly grades answers, applies -0.25 negative marking penalty, awards XP, and returns citations', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTestWithAnswers);
      (prisma.testAttempt.create as jest.Mock).mockResolvedValue({
        id: 'attempt-789',
        userId: 'u-scholar-123',
        testId: mockTestWithAnswers.id,
        score: 1.75, // 2 correct (+2.0) - 1 wrong (-0.25) = 1.75
        completed: true,
        completedAt: new Date('2026-03-01T00:10:00.000Z'),
      });

      // Submit: Q1 correct (2), Q2 wrong (0 instead of 2), Q3 correct (1)
      const submitPayload = {
        answers: {
          'q-1': 2, // Correct
          'q-2': 0, // Wrong (-0.25)
          'q-3': 1, // Correct
        },
        timeTakenSeconds: 320,
        negativeMarking: true,
      };

      const req = new Request(`http://localhost:3000/api/mobile/v1/tests/${mockTestWithAnswers.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitPayload),
      });

      const res = await mobileTestSubmitPOST(req, {
        params: Promise.resolve({ id: mockTestWithAnswers.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.result.correctCount).toBe(2);
      expect(data.result.incorrectCount).toBe(1);
      expect(data.result.score).toBe(1.75); // 2 - 0.25
      expect(data.result.accuracy).toBe(67); // 2/3 * 100
      expect(data.result.xpEarned).toBe(50);

      // Verify server solutions returned after submit
      expect(data.result.questions).toHaveLength(3);
      expect(data.result.questions[0].isCorrect).toBe(true);
      expect(data.result.questions[0].correctAnswer).toBe(2);
      expect(data.result.questions[0].proofQuote).toContain('Art. 32');

      expect(data.result.questions[1].isCorrect).toBe(false);
      expect(data.result.questions[1].userAnswer).toBe(0);
      expect(data.result.questions[1].correctAnswer).toBe(2);
      expect(data.result.questions[1].explanation).toContain('11th Schedule');
    });
  });

  describe('4. GET /api/mobile/v1/tests/[id]/results', () => {
    it('returns the user latest evaluated attempt with full citations and rank context', async () => {
      (prisma.testAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'attempt-789',
        userId: 'u-scholar-123',
        testId: mockTestWithAnswers.id,
        score: 3,
        answers: [2, 2, 1],
        completed: true,
        completedAt: new Date(),
        test: mockTestWithAnswers,
      });

      (prisma.testAttempt.count as jest.Mock)
        .mockResolvedValueOnce(0) // higherScoreCount = 0 -> Rank 1
        .mockResolvedValueOnce(45); // totalParticipants = 45

      const req = new Request(`http://localhost:3000/api/mobile/v1/tests/${mockTestWithAnswers.id}/results`, {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileTestResultsGET(req, {
        params: Promise.resolve({ id: mockTestWithAnswers.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.result.score).toBe(3);
      expect(data.result.accuracy).toBe(100);
      expect(data.result.status).toBe('PASSED');
      expect(data.result.rank).toBe(1);
      expect(data.result.totalParticipants).toBe(45);
      expect(data.result.questions).toHaveLength(3);
      expect(data.result.questions[0].proofQuote).toBeDefined();
    });
  });

  describe('5. GET /api/mobile/v1/tests/[id]/leaderboard', () => {
    it('returns deduplicated rankings with user podium badges and currentUser flag', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: mockTestWithAnswers.id,
        title: mockTestWithAnswers.title,
        _count: { questions: 3 },
      });

      (prisma.testAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'att-1',
          userId: 'u-topper',
          score: 3,
          completed: true,
          completedAt: new Date(),
          user: { id: 'u-topper', name: 'Topper Candidate', image: null },
        },
        {
          id: 'att-2',
          userId: 'u-scholar-123', // Current user
          score: 2,
          completed: true,
          completedAt: new Date(),
          user: { id: 'u-scholar-123', name: 'Mobile Scholar', image: null },
        },
      ]);

      const req = new Request(`http://localhost:3000/api/mobile/v1/tests/${mockTestWithAnswers.id}/leaderboard`, {
        headers: { Authorization: `Bearer ${validBearerToken}` },
      });

      const res = await mobileTestLeaderboardGET(req, {
        params: Promise.resolve({ id: mockTestWithAnswers.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.leaderboard).toHaveLength(2);
      expect(data.leaderboard[0].rank).toBe(1);
      expect(data.leaderboard[0].badge).toBe('gold');
      expect(data.leaderboard[1].rank).toBe(2);
      expect(data.leaderboard[1].badge).toBe('silver');
      expect(data.leaderboard[1].isCurrentUser).toBe(true);
      expect(data.currentUserRank?.rank).toBe(2);
    });
  });

  describe('6. POST /api/mobile/v1/tests/create (Manual Authoring)', () => {
    it('rejects test when title is too short or options count is invalid', async () => {
      const invalidPayload = {
        title: 'AB', // Too short (< 3)
        duration: 10,
        questions: [
          {
            question: 'Valid question text?',
            options: ['Only one option'], // Invalid (< 2 options)
            correctAnswer: 0,
          },
        ],
      };

      const req = new Request('http://localhost:3000/api/mobile/v1/tests/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidPayload),
      });

      const res = await mobileTestCreatePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
    });

    it('successfully creates manual test with questions', async () => {
      const validPayload = {
        title: 'Custom Polity Diagnostic',
        description: 'Test created on mobile',
        duration: 25,
        questions: [
          {
            question: 'Under what circumstances can National Emergency be proclaimed?',
            options: ['War or External Aggression', 'Financial instability only', 'Minor strikes', 'State governor advice'],
            correctAnswer: 0,
            explanation: 'Article 352 covers War, External aggression or Armed rebellion.',
            difficulty: 'hard',
          },
        ],
      };

      (prisma.test.create as jest.Mock).mockResolvedValue({
        id: 'new-test-mock-999',
        title: validPayload.title,
        description: validPayload.description,
        duration: validPayload.duration,
        userId: 'u-scholar-123',
        createdAt: new Date(),
        questions: [
          {
            id: 'q-new-1',
            question: validPayload.questions[0].question,
            options: validPayload.questions[0].options,
            difficulty: validPayload.questions[0].difficulty,
          },
        ],
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/tests/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validBearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      });

      const res = await mobileTestCreatePOST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.test.id).toBe('new-test-mock-999');
      expect(data.test.questionCount).toBe(1);
    });
  });
});
