import { GET as getSummary } from '../api/analytics/summary/route';
import { GET as getWeakAreas } from '../api/analytics/weak-areas/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    testAttempt: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    descriptiveTest: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
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
      const req = new Request('http://localhost:3000/api/analytics/summary');
      const res = await getSummary(req);
      expect(res.status).toBe(401);
    });

    it('calculates DB-side aggregated MCQ & descriptive test statistics and selects only needed fields', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

      // DB-side aggregation mocking
      (prisma.testAttempt.aggregate as jest.Mock).mockResolvedValue({
        _count: { _all: 50 },
        _avg: { score: 78.4 },
      });
      ((prisma as any).descriptiveTest.aggregate as jest.Mock).mockResolvedValue({
        _count: { _all: 20 },
        _avg: { score: 84.8 },
      });

      (prisma.testAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'att1',
          score: 8,
          createdAt: new Date().toISOString(),
          test: {
            title: 'Modern History',
          },
        },
      ]);
      ((prisma as any).descriptiveTest.findMany as jest.Mock).mockResolvedValue([
        { score: 85, examName: 'UPSC Essay', createdAt: new Date().toISOString() },
      ]);

      const req = new Request('http://localhost:3000/api/analytics/summary?page=1&limit=25');
      const res = await getSummary(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary.totalTests).toBe(70);
      expect(data.summary.avgMcqScore).toBe(78);
      expect(data.summary.avgDescScore).toBe(85);
      expect(data.summary.recentActivity).toHaveLength(2);
      // Pagination verification
      expect(data.summary.pagination).toBeDefined();
      expect(data.summary.pagination.page).toBe(1);
      expect(data.summary.pagination.limit).toBe(25);
      expect(data.summary.pagination.totalTests).toBe(70);

      // Verify DB-side aggregation was invoked
      expect(prisma.testAttempt.aggregate).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        _count: { _all: true },
        _avg: { score: true },
      });

      // Verify only needed fields were selected (no full questions payload)
      expect(prisma.testAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 0,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            score: true,
            createdAt: true,
            test: {
              select: {
                title: true,
              },
            },
          },
        })
      );
    });
  });

  describe('GET /api/analytics/weak-areas', () => {
    it('identifies topics with accuracy < 75%, labels window, and selects only question IDs', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
      (prisma.testAttempt.count as jest.Mock).mockResolvedValue(2);
      (prisma.testAttempt.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'a1',
          score: 4, // 40%
          test: {
            title: 'Organic Chemistry',
            questions: new Array(10).fill({ id: 'q' }),
          },
        },
        {
          id: 'a2',
          score: 9, // 90%
          test: {
            title: 'Polity',
            questions: new Array(10).fill({ id: 'q' }),
          },
        },
      ]);

      const req = new Request('http://localhost:3000/api/analytics/weak-areas?page=1&limit=10');
      const res = await getWeakAreas(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.window).toBe('last 2 attempts');
      expect(data.weakAreas).toHaveLength(1);
      expect(data.weakAreas[0].topic).toBe('Organic Chemistry');
      expect(data.weakAreas[0].accuracy).toBe(40);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.totalAttempts).toBe(2);

      // Verify Prisma query selected only question IDs rather than full question records
      expect(prisma.testAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            score: true,
            test: {
              select: {
                title: true,
                questions: {
                  select: { id: true },
                },
              },
            },
          },
        })
      );
    });
  });
});
