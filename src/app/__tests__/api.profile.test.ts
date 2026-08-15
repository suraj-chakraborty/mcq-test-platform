import { GET } from '../api/users/profile/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('User Profile API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when user is not found in database', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns full profile data and gamification stats when authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Suraj',
      email: 'suraj@example.com',
      xp: 150,
      level: 2,
      streak: 3,
      isVerified: true,
      lastActivityAt: new Date().toISOString(),
      _count: { tests: 5, attempts: 10, flashcards: 12, descriptiveTests: 2, hostedDuels: 1 },
      attempts: [
        { id: 'a1', score: 8, test: { title: 'General Science' } },
        { id: 'a2', score: 10, test: { title: 'Modern History' } },
      ],
      achievements: [
        { id: 'ach1', name: 'Speed Demon', description: 'Fast finish', icon: '⚡' },
      ],
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.name).toBe('Suraj');
    expect(data.user.level).toBe(2);
    expect(data.user.avgScore).toBe(9);
    expect(data.user._count.flashcards).toBe(12);
    expect(data.user.achievements).toHaveLength(1);
  });
});
