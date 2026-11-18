import { PUT as mobileUserUpdatePUT } from '../api/mobile/v1/users/update/route';
import { PUT as webUserUpdatePUT } from '../api/users/update/route';
import { prisma } from '@/app/lib/prisma';
import { resolveAuthUser } from '@/app/lib/mobileAuth';
import { getServerSession } from 'next-auth';

jest.mock('@/app/lib/mobileAuth', () => ({
  resolveAuthUser: jest.fn(),
  getMobileAuthUser: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Module 1: User Profile & Avatar Update Integration Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-learner-101',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    targetExam: 'GATE Engineering',
    institution: 'University of Oxford',
    academicLevel: 'Undergraduate',
    bio: 'Pioneering computer science and algorithms.',
    image: null,
    xp: 450,
    level: 2,
    streak: 5,
    isVerified: true,
  };

  describe('Mobile v1 User Update (PUT /api/mobile/v1/users/update)', () => {
    it('[P0] rejects unauthenticated requests with 401 Unauthorized', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Name' }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('[P0] updates profile picture with Cloudinary HTTPS CDN URL', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const cloudinaryUrl = 'https://res.cloudinary.com/qp-project/image/upload/v12345/avatars/ada_avatar.jpg';

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        image: cloudinaryUrl,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_mock_token',
        },
        body: JSON.stringify({
          image: cloudinaryUrl,
        }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.image).toBe(cloudinaryUrl);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ image: cloudinaryUrl }),
        })
      );
    });

    it('[P0] saves preset emoji avatar identifier string', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const presetAvatar = 'preset:scholar_male:👨‍🎓:bg-blue-600';

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        image: presetAvatar,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: presetAvatar,
        }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.image).toBe(presetAvatar);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ image: presetAvatar }),
        })
      );
    });

    it('[P0] clears avatar when image: null is provided (reverts to initials)', async () => {
      const userWithAvatar = {
        ...mockUser,
        image: 'https://res.cloudinary.com/qp-project/image/upload/v123/avatars/old.jpg',
      };

      (resolveAuthUser as jest.Mock).mockResolvedValue(userWithAvatar);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithAvatar);

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...userWithAvatar,
        image: null,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: null,
        }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.image).toBeNull();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ image: null }),
        })
      );
    });

    it('[P1] enforces phone number immutability once set', async () => {
      const userWithPhone = {
        ...mockUser,
        phone: '+15551234567',
      };

      (resolveAuthUser as jest.Mock).mockResolvedValue(userWithPhone);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithPhone);

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+15559876543',
        }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Phone number cannot be changed once set');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('[P1] rejects phone numbers already registered by another user', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Simulate phone number conflict
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-conflict-999',
        phone: '+15550001111',
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+15550001111',
        }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('already registered');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('[P1] rejects names shorter than 2 characters or longer than 50 characters', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(mockUser);

      // Test too short
      const reqShort = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A' }),
      });

      const resShort = await mobileUserUpdatePUT(reqShort);
      expect(resShort.status).toBe(400);

      // Test too long
      const reqLong = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A'.repeat(51) }),
      });

      const resLong = await mobileUserUpdatePUT(reqLong);
      expect(resLong.status).toBe(400);
    });

    it('[P0] guarantees no sensitive fields (passwords, salts, db connections) are returned', async () => {
      (resolveAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: mockUser.id,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        targetExam: 'GATE Engineering',
        institution: 'University of Oxford',
        academicLevel: 'Undergraduate',
        bio: 'Pioneering algorithms.',
        image: 'https://res.cloudinary.com/qp/image/upload/ada.jpg',
        xp: 450,
        level: 2,
        streak: 5,
        isVerified: true,
        isMarkedForDeletion: false,
        deletionRequestedAt: null,
      });

      const req = new Request('http://localhost:3000/api/mobile/v1/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: 'Pioneering algorithms.' }),
      });

      const res = await mobileUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.password).toBeUndefined();
      expect(data.user.hashedPassword).toBeUndefined();
      expect(data.user.salt).toBeUndefined();
      expect(data.user.mongodbUrl).toBeUndefined();
    });
  });

  describe('Web User Update (PUT /api/users/update)', () => {
    it('[P0] updates avatar with Cloudinary URL using NextAuth session', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const avatarUrl = 'https://res.cloudinary.com/qp-project/image/upload/v999/avatars/web_pic.png';

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        image: avatarUrl,
      });

      const req = new Request('http://localhost:3000/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: avatarUrl }),
      });

      const res = await webUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.image).toBe(avatarUrl);
    });

    it('[P0] clears avatar with image: null via web endpoint', async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: mockUser.id },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        image: 'https://example.com/old.jpg',
      });

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        image: null,
      });

      const req = new Request('http://localhost:3000/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: null }),
      });

      const res = await webUserUpdatePUT(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.image).toBeNull();
    });
  });
});
