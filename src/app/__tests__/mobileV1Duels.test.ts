import { POST as mobileCreateDuelPOST } from '../api/mobile/v1/duels/create/route';
import { POST as mobileJoinDuelPOST } from '../api/mobile/v1/duels/join/route';
import { GET as mobileGetDuelGET, POST as mobileUpdateDuelProgressPOST } from '../api/mobile/v1/duels/[roomCode]/route';
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
      findFirst: jest.fn(),
    },
    duelRoom: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Phase 6: Mobile v1 1v1 Battle/Duel Mode Endpoints', () => {
  const TEST_SECRET = 'test_secret_for_mobile_auth_32_characters_long!';
  let hostToken: string;
  let guestToken: string;

  const mockHostUser = {
    id: 'u-host-101',
    name: 'Host Gladiator',
    email: 'host@example.com',
  };

  const mockGuestUser = {
    id: 'u-guest-202',
    name: 'Challenger Blade',
    email: 'challenger@example.com',
  };

  const mockTest = {
    id: 'test-battle-55',
    title: 'Constitutional Law Duel Sprint',
    duration: 10,
    questions: [
      {
        id: 'q-b1',
        question: 'Which Article protects freedom of speech and expression?',
        options: ['Article 14', 'Article 19(1)(a)', 'Article 21', 'Article 25'],
        correctAnswer: 1,
        explanation: 'Article 19(1)(a) provides freedom of speech.',
        proofQuote: 'Constitution of India, Art. 19(1)(a)',
        difficulty: 'medium',
      },
    ],
    _count: { questions: 1 },
  };

  const mockWaitingRoom = {
    id: 'room-rec-999',
    roomCode: 'DUEL77',
    testId: mockTest.id,
    hostId: mockHostUser.id,
    guestId: null,
    status: 'WAITING',
    hostProgress: 0,
    guestProgress: 0,
    test: mockTest,
    host: mockHostUser,
    guest: null,
  };

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    hostToken = await encode({
      token: {
        id: mockHostUser.id,
        sub: mockHostUser.id,
        name: mockHostUser.name,
        email: mockHostUser.email,
      },
      secret: TEST_SECRET,
      maxAge: 900,
    });

    guestToken = await encode({
      token: {
        id: mockGuestUser.id,
        sub: mockGuestUser.id,
        name: mockGuestUser.name,
        email: mockGuestUser.email,
      },
      secret: TEST_SECRET,
      maxAge: 900,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.id === mockHostUser.id) return Promise.resolve(mockHostUser);
      if (where.id === mockGuestUser.id) return Promise.resolve(mockGuestUser);
      return Promise.resolve(null);
    });
  });

  describe('1. POST /api/mobile/v1/duels/create', () => {
    it('returns 401 when no auth is provided', async () => {
      const req = new Request('http://localhost:3000/api/mobile/v1/duels/create', { method: 'POST' });
      const res = await mobileCreateDuelPOST(req);
      expect(res.status).toBe(401);
    });

    it('creates a new battle room with a 6-character room code and hostId', async () => {
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(mockTest);
      (prisma.duelRoom.create as jest.Mock).mockResolvedValue(mockWaitingRoom);

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testId: mockTest.id }),
      });

      const res = await mobileCreateDuelPOST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.room.roomCode).toBe('DUEL77');
      expect(data.room.status).toBe('WAITING');
      expect(data.room.hostId).toBe(mockHostUser.id);
    });
  });

  describe('2. POST /api/mobile/v1/duels/join', () => {
    it('rejects if the host attempts to join their own room as guest', async () => {
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue(mockWaitingRoom);

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomCode: 'DUEL77' }),
      });

      const res = await mobileJoinDuelPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already the host');
    });

    it('successfully joins a waiting battle room atomically', async () => {
      (prisma.duelRoom.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockWaitingRoom)
        .mockResolvedValueOnce({
          ...mockWaitingRoom,
          guestId: mockGuestUser.id,
          status: 'ACTIVE',
          guest: mockGuestUser,
        });
      (prisma.duelRoom.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${guestToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomCode: 'DUEL77' }),
      });

      const res = await mobileJoinDuelPOST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.room.status).toBe('ACTIVE');
      expect(data.room.guestId).toBe(mockGuestUser.id);
    });
  });

  describe('3. GET /api/mobile/v1/duels/[roomCode] (Integrity & Polling)', () => {
    it('returns 403 if caller is an outsider neither host nor guest', async () => {
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockWaitingRoom,
        hostId: 'other-player-1',
        guestId: 'other-player-2',
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/DUEL77', {
        headers: { Authorization: `Bearer ${hostToken}` },
      });

      const res = await mobileGetDuelGET(req, { params: Promise.resolve({ roomCode: 'DUEL77' }) });
      expect(res.status).toBe(403);
    });

    it('CRITICAL: returns questions with options but strictly strips correctAnswer and explanation', async () => {
      const activeRoom = {
        ...mockWaitingRoom,
        guestId: mockGuestUser.id,
        status: 'ACTIVE',
        test: {
          id: mockTest.id,
          title: mockTest.title,
          duration: mockTest.duration,
          questions: [
            {
              id: 'q-b1',
              question: 'Which Article protects freedom of speech and expression?',
              options: ['Article 14', 'Article 19(1)(a)', 'Article 21', 'Article 25'],
              difficulty: 'medium',
            },
          ],
        },
      };

      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue(activeRoom);

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/DUEL77', {
        headers: { Authorization: `Bearer ${hostToken}` },
      });

      const res = await mobileGetDuelGET(req, { params: Promise.resolve({ roomCode: 'DUEL77' }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.room.test.questions[0].correctAnswer).toBeUndefined();
      expect(data.room.test.questions[0].explanation).toBeUndefined();
      expect(data.room.test.questions[0].proofQuote).toBeUndefined();
      expect(data.room.test.questions[0].question).toBeDefined();
    });
  });

  describe('4. POST /api/mobile/v1/duels/[roomCode] (Progress Synchronization & Monotonic Guard)', () => {
    it('updates progress monotonically and transitions to FINISHED when both players reach 100%', async () => {
      const activeRoom = {
        ...mockWaitingRoom,
        guestId: mockGuestUser.id,
        status: 'ACTIVE',
        hostProgress: 80,
        guestProgress: 100, // Guest already finished
      };

      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue(activeRoom);
      (prisma.duelRoom.update as jest.Mock).mockResolvedValue({
        ...activeRoom,
        hostProgress: 100,
        status: 'FINISHED',
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/duels/DUEL77', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress: 100 }),
      });

      const res = await mobileUpdateDuelProgressPOST(req, {
        params: Promise.resolve({ roomCode: 'DUEL77' }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.room.status).toBe('FINISHED');
      expect(data.room.hostProgress).toBe(100);
    });
  });
});
