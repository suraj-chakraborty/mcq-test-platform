import { POST } from '../api/auth/register/route';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('@/app/lib/send-mail', () => ({
  sendEmail: jest.fn(),
}));

describe('Auth Register API', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new user successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, id: '1' });

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(mockUser),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toContain('User created');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should return 400 if user already exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(mockUser),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('User already exists');
  });

  it('should return 400 for invalid data', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'J', email: 'invalid' }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
