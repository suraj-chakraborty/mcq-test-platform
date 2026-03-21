import { POST } from '../api/tests/start/route';
import { prisma } from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { generateMCQs } from '@/app/lib/ai';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/lib/ai', () => ({
  generateMCQs: jest.fn(),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
}));

describe('Test Start API', () => {
  const mockSession = { user: { id: 'user_1' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if unauthorized', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/tests/start', {
      method: 'POST',
      body: JSON.stringify({ type: 'general-knowledge' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should generate current-affairs test successfully', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (generateMCQs as jest.Mock).mockResolvedValue([{ question: 'Q1', options: ['A','B','C','D'], correctAnswer: 0, explanation: 'Exp' }]);
    (prisma.test.create as jest.Mock).mockResolvedValue({ id: 'test_1' });

    const req = new Request('http://localhost:3000/api/tests/start', {
      method: 'POST',
      body: JSON.stringify({ type: 'current-affairs', count: 5 }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.testId).toBe('test_1');
    expect(generateMCQs).toHaveBeenCalled();
  });

  it('should return 404 if no PDFs found for given IDs', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.test.findMany as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost:3000/api/tests/start', {
      method: 'POST',
      body: JSON.stringify({ pdfIds: ['pdf_1'] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(404);
  });
});
