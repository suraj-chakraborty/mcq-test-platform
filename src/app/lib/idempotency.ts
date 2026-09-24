import crypto from 'crypto';
import { prisma } from '@/app/lib/prisma';
import { Redis } from '@upstash/redis';

// Local in-memory lock table fallback
const localLocks = new Map<string, number>();

function getRedisInstance(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return new Redis({ url, token });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extracts or deterministically derives an idempotency key from the request:
 * 1. Checks `x-idempotency-key` or `idempotency-key` header
 * 2. Checks `body.idempotencyKey`
 * 3. Falls back to a deterministic SHA-256 hash of userId + payload attributes
 */
export function extractIdempotencyKey(
  req: Request,
  body?: any,
  fallbackContext?: { userId: string; [key: string]: any }
): string {
  const headerKey =
    req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }

  if (body?.idempotencyKey && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) {
    return body.idempotencyKey.trim();
  }

  // Generate deterministic fallback fingerprint
  const fingerprintObj = {
    userId: fallbackContext?.userId || 'anonymous',
    title: body?.title || fallbackContext?.title || '',
    topic: body?.domainTopic || body?.topic || fallbackContext?.topic || '',
    numQuestions: body?.numQuestions || fallbackContext?.numQuestions || 10,
    files: body?.contextPDFs?.map((f: any) => f.name || f.url) || fallbackContext?.files || [],
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprintObj))
    .digest('hex');
}

/**
 * Attempts to acquire an in-flight execution lock for the given idempotency key.
 * Prevents simultaneous duplicate execution (double-clicks).
 * Returns `true` if lock acquired, `false` if operation is already in flight.
 */
export async function acquireIdempotencyLock(
  key: string,
  ttlMs = 90000
): Promise<boolean> {
  const lockKey = `lock:idemp:${key}`;
  const redis = getRedisInstance();

  if (redis) {
    try {
      // SET lockKey 1 NX PX ttlMs
      const res = await redis.set(lockKey, '1', {
        nx: true,
        px: ttlMs,
      });
      return res === 'OK' || res === true;
    } catch (err) {
      console.warn('Redis lock error, falling back to local memory lock:', err);
    }
  }

  // In-memory lock fallback
  const now = Date.now();
  const existing = localLocks.get(lockKey);
  if (existing && existing > now) {
    return false; // Still locked
  }

  localLocks.set(lockKey, now + ttlMs);
  return true;
}

/**
 * Releases the in-flight execution lock.
 */
export async function releaseIdempotencyLock(key: string): Promise<void> {
  const lockKey = `lock:idemp:${key}`;
  const redis = getRedisInstance();

  if (redis) {
    try {
      await redis.del(lockKey);
    } catch (err) {
      console.warn('Redis lock release error:', err);
    }
  }

  localLocks.delete(lockKey);
}

/**
 * Checks database for an existing test created under this idempotency key.
 * If found, returns the test directly to prevent duplicate test generation and token burn.
 */
export async function findExistingTestByIdempotencyKey(
  userId: string,
  idempotencyKey: string
) {
  if (!idempotencyKey || !userId) {
    return null;
  }

  return await prisma.test.findFirst({
    where: {
      userId,
      idempotencyKey,
    },
    include: {
      questions: true,
      pdfs: true,
    },
  });
}
