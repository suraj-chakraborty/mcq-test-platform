import { GET as getSummary } from '../api/analytics/summary/route';
import { GET as getWeakAreas } from '../api/analytics/weak-areas/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    testAttempt: {
      findMany: jest.fn(),
    },
    descriptiveTest: {
      findMany: jest.fn(),
    },
  },
}));

describe('Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('returns 401 when unauthorized', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const res = await getSummary();
      expect(res.status).toBe(401);
    });

    it('calculates aggregated MCQ & descriptive test statistics', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.testAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          score: 8,
          createdAt: new Date().toISOString(),
          test: {
            title: 'Modern History',
            questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }, { id: 'q7' }, { id: 'q8' }, { id: 'q9' }, { id: 'q10' }],
          },
        },
      ]);
      ((prisma as any).descriptiveTest.findMany as jest.Mock).mockResolvedValue([
        { score: 85, examName: 'UPSC Essay', createdAt: new Date().toISOString() },
      ]);

      const res = await getSummary();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary.totalTests).toBe(2);
      expect(data.summary.avgMcqScore).toBe(80);
      expect(data.summary.avgDescScore).toBe(85);
      expect(data.summary.recentActivity).toHaveLength(2);
    });
  });

  describe('GET /api/analytics/weak-areas', () => {
    it('identifies topics with accuracy < 75%', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.testAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          score: 4, // 40%
          test: {
            title: 'Organic Chemistry',
            questions: new Array(10).fill({ id: 'q' }),
          },
        },
        {
          score: 9, // 90%
          test: {
            title: 'Polity',
            questions: new Array(10).fill({ id: 'q' }),
          },
        },
      ]);

      const res = await getWeakAreas();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.weakAreas).toHaveLength(1);
      expect(data.weakAreas[0].topic).toBe('Organic Chemistry');
      expect(data.weakAreas[0].accuracy).toBe(40);
    });
  });
});
