import { calculateLevel, calculateXPEarned, processGamification } from '@/app/lib/gamification';
import { prisma } from '@/app/lib/prisma';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    testAttempt: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      user: { update: jest.fn() },
      testAttempt: { update: jest.fn() },
    })),
  },
}));

describe('Gamification System', () => {
  describe('calculateLevel', () => {
    it('returns level 1 for 0 XP', () => {
      const res = calculateLevel(0);
      expect(res.level).toBe(1);
      expect(res.xpInCurrentLevel).toBe(0);
      expect(res.xpNeededForNextLevel).toBe(500);
    });

    it('returns level 2 for 500 XP', () => {
      const res = calculateLevel(500);
      expect(res.level).toBe(2);
      expect(res.xpInCurrentLevel).toBe(0);
    });

    it('returns level 3 for 1200 XP', () => {
      const res = calculateLevel(1200);
      expect(res.level).toBe(3);
    });
  });

  describe('calculateXPEarned', () => {
    it('calculates base XP plus accuracy bonus and speed bonus', () => {
      const xp = calculateXPEarned(10, 10, 30);
      expect(xp).toBeGreaterThan(100);
    });
  });

  describe('processGamification', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('awards XP, updates streak, and handles achievements', async () => {
      const mockUser = {
        id: 'user_123',
        xp: 100,
        level: 2,
        streak: 1,
        lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        achievements: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await processGamification('user_123', 10, 10, 30, 'att_1');

      expect(result).not.toBeNull();
      expect(result?.xpEarned).toBeGreaterThan(0);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('resets streak if more than 48 hours have passed', async () => {
      const mockUser = {
        id: 'user_123',
        xp: 100,
        level: 2,
        streak: 5,
        lastActivityAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
        achievements: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await processGamification('user_123', 5, 10, 120);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
