import {
  extractIdempotencyKey,
  acquireIdempotencyLock,
  releaseIdempotencyLock,
  findExistingTestByIdempotencyKey,
} from '@/app/lib/idempotency';
import { prisma } from '@/app/lib/prisma';

jest.mock('@/app/lib/prisma', () => ({
  prisma: {
    test: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Idempotency Key & In-Flight Lock Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractIdempotencyKey', () => {
    it('extracts key from x-idempotency-key header', () => {
      const req = new Request('http://localhost:3000/api/pdf-tests/create', {
        headers: { 'x-idempotency-key': 'user-req-uuid-12345' },
      });
      const key = extractIdempotencyKey(req);
      expect(key).toBe('user-req-uuid-12345');
    });

    it('extracts key from idempotency-key header', () => {
      const req = new Request('http://localhost:3000/api/pdf-tests/create', {
        headers: { 'idempotency-key': 'standard-idemp-999' },
      });
      const key = extractIdempotencyKey(req);
      expect(key).toBe('standard-idemp-999');
    });

    it('extracts key from body payload', () => {
      const req = new Request('http://localhost:3000/api/pdf-tests/create');
      const key = extractIdempotencyKey(req, { idempotencyKey: 'payload-idemp-456' });
      expect(key).toBe('payload-idemp-456');
    });

    it('generates deterministic fingerprint hash when no explicit key is provided', () => {
      const req1 = new Request('http://localhost:3000/api/pdf-tests/create');
      const req2 = new Request('http://localhost:3000/api/pdf-tests/create');

      const payload = {
        title: 'Cell Biology Notes',
        domainTopic: 'Biology',
        numQuestions: 15,
      };

      const key1 = extractIdempotencyKey(req1, payload, { userId: 'usr_1' });
      const key2 = extractIdempotencyKey(req2, payload, { userId: 'usr_1' });
      const keyDiffUser = extractIdempotencyKey(req1, payload, { userId: 'usr_2' });

      expect(key1).toBeDefined();
      expect(key1).toHaveLength(64); // SHA-256 hex string
      expect(key1).toBe(key2); // Deterministic matching
      expect(key1).not.toBe(keyDiffUser); // Different user produces different key
    });
  });

  describe('acquireIdempotencyLock & releaseIdempotencyLock', () => {
    it('acquires lock for fresh key and blocks concurrent duplicates', async () => {
      const testKey = `test-key-${Date.now()}`;

      // First request: lock acquired
      const lock1 = await acquireIdempotencyLock(testKey, 10000);
      expect(lock1).toBe(true);

      // Second simultaneous request (double-click): rejected
      const lock2 = await acquireIdempotencyLock(testKey, 10000);
      expect(lock2).toBe(false);

      // Release lock
      await releaseIdempotencyLock(testKey);

      // Subsequent request after completion/release: allowed
      const lock3 = await acquireIdempotencyLock(testKey, 10000);
      expect(lock3).toBe(true);

      // Clean up
      await releaseIdempotencyLock(testKey);
    });
  });

  describe('findExistingTestByIdempotencyKey', () => {
    it('returns existing test from database when key matches', async () => {
      const mockTest = {
        id: 'test_existing_123',
        title: 'World War II History',
        userId: 'u1',
        idempotencyKey: 'idemp-history-1',
        questions: [{ id: 'q1', question: 'When did WWII end?' }],
        pdfs: [{ id: 'p1', name: 'history.pdf' }],
      };

      (prisma.test.findFirst as jest.Mock).mockResolvedValue(mockTest);

      const found = await findExistingTestByIdempotencyKey('u1', 'idemp-history-1');
      expect(prisma.test.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          idempotencyKey: 'idemp-history-1',
        },
        include: {
          questions: true,
          pdfs: true,
        },
      });
      expect(found).toEqual(mockTest);
    });

    it('returns null when no existing test matches the key', async () => {
      (prisma.test.findFirst as jest.Mock).mockResolvedValue(null);

      const found = await findExistingTestByIdempotencyKey('u1', 'new-nonexistent-key');
      expect(found).toBeNull();
    });
  });
});
