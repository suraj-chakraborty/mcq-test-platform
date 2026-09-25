import { PUT } from '../api/users/update/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';

jest.mock('next-auth');
jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('User Update API (SEC-001 Regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/users/update', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Valid Name' }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('updates profile and strictly excludes mongodbUrl and sensitive credentials from response', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-sec-001' },
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-sec-001',
      name: 'Old Name',
      email: 'student@example.com',
      phone: null,
      mongodbUrl: 'mongodb+srv://admin:SUPER_SECRET_LEAK@cluster0.mongodb.net/prod',
    });

    (prisma.user.update as jest.Mock).mockResolvedValue({
      id: 'user-sec-001',
      name: 'New Name',
      email: 'student@example.com',
      phone: null,
      targetExam: 'UPSC CSE',
      institution: 'IIT',
      academicLevel: 'Graduate',
      bio: 'Lifelong learner',
      image: 'https://example.com/avatar.jpg',
      mongodbUrl: 'mongodb+srv://admin:SUPER_SECRET_LEAK@cluster0.mongodb.net/prod',
    });

    const req = new Request('http://localhost:3000/api/users/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Name',
        targetExam: 'UPSC CSE',
        institution: 'IIT',
        academicLevel: 'Graduate',
        bio: 'Lifelong learner',
      }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.name).toBe('New Name');
    expect(data.user.id).toBe('user-sec-001');

    // Security Assertions (SEC-001)
    expect(data.user.mongodbUrl).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('mongodb');
    expect(JSON.stringify(data)).not.toContain('SUPER_SECRET_LEAK');
    expect(JSON.stringify(data)).not.toContain('cluster0.mongodb.net');
  });
});
