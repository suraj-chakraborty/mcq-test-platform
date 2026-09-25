import { POST as mobileMathSolvePOST } from '../api/mobile/v1/math/solve/route';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';
import { encode } from 'next-auth/jwt';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    test: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/app/lib/ai', () => ({
  getGenAIInstance: jest.fn(),
}));

describe('Phase 7: Mobile v1 Math OCR Solver Endpoint', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';
  let validBearerToken: string;

  const mockUser = {
    id: 'u-math-student-1',
    name: 'Euler Student',
    email: 'euler@example.com',
  };

  const mockGeminiMathOutput = {
    originalQuestion: 'Solve for x: \\int 2x \\, dx = 10',
    solutionSteps: [
      {
        title: 'Step 1: Apply Power Rule for Integration',
        content: 'Integrate 2x with respect to x using the rule \\int x^n dx = \\frac{x^{n+1}}{n+1}.',
        math: '\\int 2x dx = 2 \\cdot \\frac{x^2}{2} = x^2 + C',
      },
      {
        title: 'Step 2: Solve the Algebraic Equation',
        content: 'Assuming constant C = 0, set x^2 = 10 and take the square root.',
        math: 'x = \\pm \\sqrt{10}',
      },
    ],
    finalAnswer: 'x = \\pm \\sqrt{10}',
    title: 'Calculus: Indefinite Integral of Linear Term',
    description: 'Calculus practice problems generated from user photo.',
    questions: [
      {
        question: 'What is the indefinite integral \\int 3x^2 dx?',
        options: ['x^3 + C', '3x^3 + C', '6x + C', 'x^2 + C'],
        correctAnswer: 0,
        explanation: 'The power rule gives 3 * (x^3 / 3) = x^3 + C.',
        difficulty: 'medium',
      },
      {
        question: 'Evaluate \\int 4x^3 dx.',
        options: ['x^4 + C', '12x^2 + C', '4x^4 + C', '2x^4 + C'],
        correctAnswer: 0,
        explanation: 'Applying power rule gives x^4 + C.',
        difficulty: 'medium',
      },
      {
        question: 'What is \\int 5 dx?',
        options: ['5x + C', '5 + C', '0', 'x/5 + C'],
        correctAnswer: 0,
        explanation: 'The integral of a constant k is kx + C.',
        difficulty: 'easy',
      },
      {
        question: 'Differentiate x^3 with respect to x.',
        options: ['3x^2', 'x^2', '3x', 'x^4 / 4'],
        correctAnswer: 0,
        explanation: 'Power rule for differentiation yields 3x^2.',
        difficulty: 'easy',
      },
      {
        question: 'What is \\int 0 dx?',
        options: ['C', '0', 'x + C', 'Undefined'],
        correctAnswer: 0,
        explanation: 'The integral of 0 is an arbitrary constant C.',
        difficulty: 'easy',
      },
    ],
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
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, xp: 10 });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/jpeg;base64,1234' }),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects requests with missing image with 400', async () => {
    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validBearerToken}`,
      },
      body: JSON.stringify({}),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request payload');
  });

  it('rejects SSRF attempts targeting local network / internal hosts with 400', async () => {
    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validBearerToken}`,
      },
      body: JSON.stringify({ image: 'http://127.0.0.1/admin/keys.jpg' }),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Disallowed image host');
  });

  it('successfully solves equation from image, creates practice test with sanitized questions, and awards XP', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify(mockGeminiMathOutput),
    });

    (getGenAIInstance as jest.Mock).mockReturnValue({
      models: {
        generateContent: mockGenerateContent,
      },
    });

    const createdTest = {
      id: 'test-math-generated-1',
      userId: mockUser.id,
      title: mockGeminiMathOutput.title,
      description: mockGeminiMathOutput.description,
      duration: 30,
      questions: mockGeminiMathOutput.questions.map((q, idx) => ({
        id: `q-math-${idx}`,
        testId: 'test-math-generated-1',
        ...q,
      })),
    };

    (prisma.test.create as jest.Mock).mockResolvedValue(createdTest);

    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validBearerToken}`,
      },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
        topic: 'Calculus Integration',
      }),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.originalQuestion).toBe(mockGeminiMathOutput.originalQuestion);
    expect(data.solutionSteps).toHaveLength(2);
    expect(data.finalAnswer).toBe(mockGeminiMathOutput.finalAnswer);
    expect(data.xpEarned).toBe(10);

    // Verify questions in returned test are sanitized (no answer leaks!)
    expect(data.test.questions).toHaveLength(5);
    data.test.questions.forEach((q: any) => {
      expect(q).not.toHaveProperty('correctAnswer');
      expect(q).not.toHaveProperty('explanation');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q.options).toHaveLength(4);
    });

    // Verify user received +10 XP
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockUser.id },
        data: { xp: { increment: 10 } },
      })
    );
  });

  it('successfully solves problem from typed math query without image', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify(mockGeminiMathOutput),
    });

    (getGenAIInstance as jest.Mock).mockReturnValue({
      models: {
        generateContent: mockGenerateContent,
      },
    });

    const createdTest = {
      id: 'test-math-generated-2',
      userId: mockUser.id,
      title: mockGeminiMathOutput.title,
      description: mockGeminiMathOutput.description,
      duration: 30,
      questions: mockGeminiMathOutput.questions.map((q, idx) => ({
        id: `q-math-${idx}`,
        testId: 'test-math-generated-2',
        ...q,
      })),
    };

    (prisma.test.create as jest.Mock).mockResolvedValue(createdTest);

    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validBearerToken}`,
      },
      body: JSON.stringify({
        query: '\\int 2x dx = 10',
        topic: 'Calculus',
      }),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.originalQuestion).toBe(mockGeminiMathOutput.originalQuestion);
    expect(data.solutionSteps).toHaveLength(2);
  });

  it('handles AI generation failure gracefully with 502', async () => {
    (getGenAIInstance as jest.Mock).mockReturnValue({
      models: {
        generateContent: jest.fn().mockRejectedValue(new Error('AI Quota exceeded')),
      },
    });

    const req = new Request('http://localhost:3000/api/mobile/v1/math/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validBearerToken}`,
      },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,dummybase64string',
      }),
    });

    const res = await mobileMathSolvePOST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('Failed to generate math MCQs from image');
  });
});
