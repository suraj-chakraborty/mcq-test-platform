import { POST as verifyAIPOST } from '../api/settings/verify-ai/route';
import { getGenAIInstance } from '@/app/lib/ai';
import { getServerSession } from 'next-auth';
import { RateLimiterService } from '@/app/lib/rateLimiter';

jest.mock('@/app/lib/ai');
jest.mock('next-auth');
jest.mock('@/app/lib/rateLimiter');

describe('Settings & AI Provider Verification API', () => {
  const mockCheckLimit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
    });
    mockCheckLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });
    (RateLimiterService as jest.Mock).mockImplementation(() => ({
      checkLimit: mockCheckLimit,
      isConfigured: () => true,
    }));
  });

  it('rejects unauthenticated requests with 401', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/settings/verify-ai', {
      method: 'POST',
      body: JSON.stringify({ provider: 'default' }),
    });

    const res = await verifyAIPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects requests exceeding rate limits with 429', async () => {
    mockCheckLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 45000,
      errorReason: 'RATE_EXCEEDED',
    });

    const req = new Request('http://localhost:3000/api/settings/verify-ai', {
      method: 'POST',
      body: JSON.stringify({ provider: 'default' }),
    });

    const res = await verifyAIPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  it('verifies default system AI provider connection', async () => {
    (getGenAIInstance as jest.Mock).mockReturnValue({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'READY',
        }),
      },
    });

    const req = new Request('http://localhost:3000/api/settings/verify-ai', {
      method: 'POST',
      body: JSON.stringify({ provider: 'default' }),
    });

    const res = await verifyAIPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('System Gemini connection verified');
  });

  it('returns 400 when custom provider has no API key', async () => {
    const req = new Request('http://localhost:3000/api/settings/verify-ai', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openai', apiKey: '' }),
    });

    const res = await verifyAIPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('API key is required');
  });

  it('verifies OpenAI connection using custom key and endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'READY' } }],
      }),
    });

    const req = new Request('http://localhost:3000/api/settings/verify-ai', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-test-key-123', model: 'gpt-4o-mini' }),
    });

    const res = await verifyAIPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('OpenAI (gpt-4o-mini)');
  });
});
