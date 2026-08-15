import { POST as createDuelPOST } from '../api/duels/create/route';
import { POST as joinDuelPOST } from '../api/duels/join/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    duelRoom: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Duels API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/duels/create', () => {
    it('creates a new duel room with unique room code', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'host_1' } });
      (prisma.duelRoom.create as jest.Mock).mockResolvedValue({
        id: 'room_1',
        roomCode: 'ABC123',
        testId: 't1',
        hostId: 'host_1',
        status: 'WAITING',
      });

      const req = new Request('http://localhost:3000/api/duels/create', {
        method: 'POST',
        body: JSON.stringify({ testId: 't1' }),
      });

      const res = await createDuelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.room.status).toBe('WAITING');
      expect(prisma.duelRoom.create).toHaveBeenCalled();
    });

    it('returns 400 when testId is missing', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'host_1' } });
      const req = new Request('http://localhost:3000/api/duels/create', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await createDuelPOST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/duels/join', () => {
    it('allows a guest player to join a waiting room', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'guest_1' } });
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue({
        id: 'room_1',
        roomCode: 'ABC123',
        hostId: 'host_1',
        status: 'WAITING',
      });
      (prisma.duelRoom.update as jest.Mock).mockResolvedValue({
        id: 'room_1',
        roomCode: 'ABC123',
        hostId: 'host_1',
        guestId: 'guest_1',
        status: 'ACTIVE',
      });

      const req = new Request('http://localhost:3000/api/duels/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: 'ABC123' }),
      });

      const res = await joinDuelPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.room.status).toBe('ACTIVE');
    });

    it('returns 400 if user tries to join their own room as guest', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'host_1' } });
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue({
        id: 'room_1',
        roomCode: 'ABC123',
        hostId: 'host_1',
        status: 'WAITING',
      });

      const req = new Request('http://localhost:3000/api/duels/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: 'ABC123' }),
      });

      const res = await joinDuelPOST(req);
      expect(res.status).toBe(400);
    });

    it('returns 404 if room does not exist', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'guest_1' } });
      (prisma.duelRoom.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/duels/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode: 'NONEXIST' }),
      });

      const res = await joinDuelPOST(req);
      expect(res.status).toBe(404);
    });
  });
});
