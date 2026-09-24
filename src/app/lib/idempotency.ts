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

export const DEFAULT_LOCK_TTL_MS = 180000; // 180s (3 minutes) - strictly exceeds max generation time
export const FINGERPRINT_DEDUPE_WINDOW_MS = 120000; // 120s (2 minutes) - prevents double-clicks without blocking intentional regeneration

/**
 * Extracts or deterministically derives an idempotency key from the request:
 * 1. Checks `x-idempotency-key` or `idempotency-key` header
 * 2. Checks `body.idempotencyKey`
 * 3. Incorporates `x-client-nonce` / `clientNonce` to prevent blocking intentional retries/regeneration
 * 4. Falls back to a deterministic SHA-256 hash of userId + payload attributes + optional client nonce
 */
export function extractIdempotencyKey(
  req: Request,
  body?: any,
  fallbackContext?: { userId: string; clientNonce?: string; [key: string]: any }
): string {
  // Extract client nonce if provided (per-click nonce for intentional regenerations)
  const clientNonce =
    req.headers.get('x-client-nonce') ||
    body?.clientNonce ||
    fallbackContext?.clientNonce ||
    (req.url ? new URL(req.url, 'http://localhost:3000').searchParams.get('clientNonce') : null) ||
    '';

  const headerKey =
    req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
  if (headerKey && headerKey.trim()) {
    const cleanHeaderKey = headerKey.trim();
    return clientNonce ? `${cleanHeaderKey}:${clientNonce}` : cleanHeaderKey;
  }

  if (body?.idempotencyKey && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) {
    const cleanBodyKey = body.idempotencyKey.trim();
    return clientNonce ? `${cleanBodyKey}:${clientNonce}` : cleanBodyKey;
  }

  // Generate deterministic fallback fingerprint with short TTL window
  const fingerprintObj = {
    userId: fallbackContext?.userId || 'anonymous',
    title: body?.title || fallbackContext?.title || '',
    topic: body?.domainTopic || body?.topic || fallbackContext?.topic || '',
    numQuestions: body?.numQuestions || fallbackContext?.numQuestions || 10,
    files: body?.contextPDFs?.map((f: any) => f.name || f.url) || fallbackContext?.files || [],
    clientNonce: clientNonce || undefined, // Intentional regeneration nonce
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprintObj))
    .digest('hex');

  return `fp:${hash}`;
}

/**
 * Attempts to acquire an in-flight execution lock for the given idempotency key.
 * Prevents simultaneous duplicate execution (double-clicks).
 * Lock TTL defaults to 180,000ms (3 minutes) to strictly exceed maximum generation duration.
 * Returns `true` if lock acquired, `false` if operation is already in flight.
 */
export async function acquireIdempotencyLock(
  key: string,
  ttlMs = DEFAULT_LOCK_TTL_MS
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
 *
 * For automatic payload fingerprints (starting with `fp:`), applies a short TTL window
 * (default 120s) so intentional regeneration is not blocked indefinitely.
 */
export async function findExistingTestByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  maxAgeMs?: number
) {
  if (!idempotencyKey || !userId) {
    return null;
  }

  const isFingerprint = idempotencyKey.startsWith('fp:');
  const effectiveMaxAge = maxAgeMs !== undefined ? maxAgeMs : (isFingerprint ? FINGERPRINT_DEDUPE_WINDOW_MS : undefined);

  const whereClause: any = {
    userId,
    idempotencyKey,
  };

  if (effectiveMaxAge !== undefined) {
    whereClause.createdAt = {
      gte: new Date(Date.now() - effectiveMaxAge),
    };
  }

  return await prisma.test.findFirst({
    where: whereClause,
    include: {
      questions: true,
      pdfs: true,
    },
  });
}
