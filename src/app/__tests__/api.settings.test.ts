import { POST as verifyAIPOST } from '../api/settings/verify-ai/route';
import { getGenAIInstance } from '@/app/lib/ai';

jest.mock('@/app/lib/ai');

describe('Settings & AI Provider Verification API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
