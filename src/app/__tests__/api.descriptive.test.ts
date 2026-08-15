import { POST as evaluatePOST } from '../api/descriptive/evaluate/route';
import { GET as historyGET } from '../api/descriptive/history/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';

jest.mock('next-auth');
jest.mock('@/app/lib/ai');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    descriptiveTest: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Descriptive Writing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/descriptive/evaluate', () => {
    it('returns 401 when unauthorized', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/descriptive/evaluate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 when body fails schema validation', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      const req = new Request('http://localhost:3000/api/descriptive/evaluate', {
        method: 'POST',
        body: JSON.stringify({ examName: 'UPSC' }), // Missing required fields
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(400);
    });

    it('evaluates essay using Gemini and stores results in database', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      const mockEvaluation = {
        score: 88,
        feedback: 'Well articulated with structured arguments.',
        strengths: ['Clear introduction', 'Good examples'],
        areasToImprove: ['Conclusion could be stronger'],
        suggestions: ['Include more recent case studies'],
      };

      (getGenAIInstance as jest.Mock).mockReturnValue({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify(mockEvaluation),
          }),
        },
      });

      ((prisma as any).descriptiveTest.create as jest.Mock).mockResolvedValue({
        id: 'desc_1',
        ...mockEvaluation,
      });

      const req = new Request('http://localhost:3000/api/descriptive/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          examName: 'UPSC Mains',
          question: 'Discuss the impact of renewable energy in India.',
          answer: 'India has made remarkable strides in expanding its renewable energy capacity...',
          wordCount: 250,
          timeLimit: 15,
          timeTaken: 12,
        }),
      });

      const res = await evaluatePOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.test.score).toBe(88);
      expect((prisma as any).descriptiveTest.create).toHaveBeenCalled();
    });
  });

  describe('GET /api/descriptive/history', () => {
    it('fetches paginated history for user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      ((prisma as any).descriptiveTest.findMany as jest.Mock).mockResolvedValue([
        { id: 'desc_1', examName: 'UPSC Mains', score: 88 },
      ]);
      ((prisma as any).descriptiveTest.count as jest.Mock).mockResolvedValue(1);

      const req = new Request('http://localhost:3000/api/descriptive/history?page=1&limit=10');
      const res = await historyGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tests).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
    });
  });
});
