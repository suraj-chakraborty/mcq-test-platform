import {
  objectIdSchema,
  paginationQuerySchema,
  sanitizeNoSqlInput,
  safeJsonParse,
} from '@/app/lib/validations/common';
import { registerSchema, loginSchema } from '@/app/lib/validations/auth';
import { testAttemptSchema } from '@/app/lib/validations/test';

describe('Input Validation & NoSQL Injection Defenses (Step 1)', () => {
  describe('sanitizeNoSqlInput', () => {
    it('allows clean primitives, arrays, and standard objects', () => {
      const clean = {
        name: 'Alice',
        age: 25,
        hobbies: ['reading', 'chess'],
        meta: { active: true },
      };
      expect(sanitizeNoSqlInput(clean)).toEqual(clean);
      expect(sanitizeNoSqlInput('safe string')).toBe('safe string');
      expect(sanitizeNoSqlInput(12345)).toBe(12345);
      expect(sanitizeNoSqlInput(null)).toBeNull();
      expect(sanitizeNoSqlInput(undefined)).toBeUndefined();
    });

    it('throws error when top-level key starts with $ (e.g. $gt, $ne, $where)', () => {
      expect(() => sanitizeNoSqlInput({ $gt: '' })).toThrow(
        /forbidden operator characters/
      );
      expect(() => sanitizeNoSqlInput({ $ne: null })).toThrow(
        /forbidden operator characters/
      );
      expect(() => sanitizeNoSqlInput({ $where: 'sleep(5000)' })).toThrow(
        /forbidden operator characters/
      );
    });

    it('throws error when deeply nested key starts with $', () => {
      const nestedPayload = {
        filter: {
          subQuery: {
            $regex: '.*',
          },
        },
      };
      expect(() => sanitizeNoSqlInput(nestedPayload)).toThrow(
        /forbidden operator characters/
      );
    });

    it('throws error when object key contains dot notation', () => {
      expect(() => sanitizeNoSqlInput({ 'user.isAdmin': true })).toThrow(
        /forbidden operator characters/
      );
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON and returns sanitized data', async () => {
      const req = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Math Test', count: 10 }),
      });

      const result = await safeJsonParse(req);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ title: 'Math Test', count: 10 });
      }
    });

    it('rejects oversized payloads with 413 based on Content-Length', async () => {
      const req = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '5000000', // 5MB
        },
        body: JSON.stringify({ a: 1 }),
      });

      const result = await safeJsonParse(req, 2 * 1024 * 1024); // 2MB max
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(413);
        const body = await result.response.json();
        expect(body.code).toBe('PAYLOAD_TOO_LARGE');
      }
    });

    it('returns 400 when JSON syntax is malformed', async () => {
      const req = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json: true, ',
      });

      const result = await safeJsonParse(req);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const body = await result.response.json();
        expect(body.code).toBe('MALFORMED_JSON');
      }
    });

    it('returns 400 with NOSQL_INJECTION_DETECTED when payload contains NoSQL operators', async () => {
      const req = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: { $ne: '' }, password: { $gt: '' } }),
      });

      const result = await safeJsonParse(req);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const body = await result.response.json();
        expect(body.code).toBe('NOSQL_INJECTION_DETECTED');
      }
    });
  });

  describe('objectIdSchema', () => {
    it('accepts 24-character hexadecimal MongoDB ObjectIds', () => {
      expect(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
      expect(objectIdSchema.safeParse('64b8a2c59d1a3e0012345678').success).toBe(true);
    });

    it('accepts safe alphanumeric entity IDs with hyphens or underscores', () => {
      expect(objectIdSchema.safeParse('test_123').success).toBe(true);
      expect(objectIdSchema.safeParse('q-456').success).toBe(true);
      expect(objectIdSchema.safeParse('duel_room_abc').success).toBe(true);
    });

    it('rejects characters used in injection attacks', () => {
      expect(objectIdSchema.safeParse('{"$ne": null}').success).toBe(false);
      expect(objectIdSchema.safeParse("1' OR '1'='1").success).toBe(false);
      expect(objectIdSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
      expect(objectIdSchema.safeParse('../path/traversal').success).toBe(false);
      expect(objectIdSchema.safeParse('id with spaces').success).toBe(false);
      expect(objectIdSchema.safeParse('null\0byte').success).toBe(false);
      expect(objectIdSchema.safeParse('').success).toBe(false);
    });
  });

  describe('paginationQuerySchema', () => {
    it('applies safe defaults for missing parameters', () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.search).toBe('');
      }
    });

    it('caps limit at 50 to prevent memory exhaustion / DoS', () => {
      const result = paginationQuerySchema.safeParse({ limit: 10000 });
      expect(result.success).toBe(false);
    });

    it('rejects unknown query fields', () => {
      const result = paginationQuerySchema.safeParse({
        page: 1,
        limit: 10,
        unauthorizedField: 'attack',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Strict Zod Schema Enforcement (.strict())', () => {
    it('registerSchema rejects unauthorized elevated role or flag injection', () => {
      const maliciousRegister = {
        name: 'Attacker',
        email: 'attacker@example.com',
        password: 'password123',
        role: 'ADMIN',
        isAdmin: true,
      };

      const result = registerSchema.safeParse(maliciousRegister);
      expect(result.success).toBe(false);
    });

    it('loginSchema rejects unknown fields', () => {
      const maliciousLogin = {
        email: 'user@example.com',
        password: 'password123',
        extraField: 'payload',
      };

      const result = loginSchema.safeParse(maliciousLogin);
      expect(result.success).toBe(false);
    });

    it('testAttemptSchema rejects unknown fields', () => {
      const maliciousAttempt = {
        testId: '507f1f77bcf86cd799439011',
        answers: [0, 1, 2],
        score: 100, // Client attempting to tamper with score directly
      };

      const result = testAttemptSchema.safeParse(maliciousAttempt);
      expect(result.success).toBe(false);
    });
  });
});
