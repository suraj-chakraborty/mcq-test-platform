const rateLimitMap = new Map<string, { count: number; lastRequest: number }>();
const WINDOW_SIZE_MS = 15 * 1000; // 15 seconds
const MAX_ATTEMPTS = 5;

export function rateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, lastRequest: now };

  if (now - entry.lastRequest > WINDOW_SIZE_MS) {
    rateLimitMap.set(ip, { count: 1, lastRequest: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((WINDOW_SIZE_MS - (now - entry.lastRequest)) / 1000),
    };
  }

  rateLimitMap.set(ip, { count: entry.count + 1, lastRequest: entry.lastRequest });
  return { allowed: true };
}
