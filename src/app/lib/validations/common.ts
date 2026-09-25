import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Validates a safe MongoDB ObjectId or safe alphanumeric entity identifier:
 * - Allows 24-character hexadecimal MongoDB ObjectIds
 * - Allows alphanumeric IDs with hyphens/underscores (safe against NoSQL operator injection)
 * - Rejects any characters like $, ., quotes, or operators
 */
export const objectIdSchema = z
  .string()
  .trim()
  .min(1, 'ID cannot be empty')
  .max(64, 'ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format: must contain only alphanumeric characters, dashes, or underscores');


/**
 * Validates standard pagination query parameters with safe defaults and upper bounds
 */
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).optional().default(''),
  })
  .strict();

/**
 * Rejects or strips any key starting with '$' or containing '.' to prevent NoSQL operator injection.
 * Throws an Error if a forbidden operator key is detected.
 */
export function sanitizeNoSqlInput<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeNoSqlInput(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key.startsWith('$') || key.includes('.')) {
        throw new Error(`Invalid request payload: key contains forbidden operator characters ("${key}")`);
      }
      cleanObj[key] = sanitizeNoSqlInput(value);
    }
    return cleanObj as T;
  }

  return input;
}

/**
 * Safe JSON parser for incoming Request streams:
 * - Checks Content-Length header against max allowable bytes
 * - Safely parses JSON and strips NoSQL operator keys
 * - Returns structured error response instead of throwing unhandled 500
 */
export async function safeJsonParse<T = any>(
  req: Request,
  maxSizeBytes: number = 2 * 1024 * 1024 // Default 2MB limit
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: `Payload too large. Maximum allowed size is ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`,
            code: 'PAYLOAD_TOO_LARGE',
          },
          { status: 413 }
        ),
      };
    }

    const raw = await req.json();
    const sanitized = sanitizeNoSqlInput(raw);
    return { success: true, data: sanitized };
  } catch (error: any) {
    const isNoSqlError = error?.message?.includes('forbidden operator characters');
    return {
      success: false,
      response: NextResponse.json(
        {
          error: isNoSqlError ? error.message : 'Invalid or malformed JSON in request body.',
          code: isNoSqlError ? 'NOSQL_INJECTION_DETECTED' : 'MALFORMED_JSON',
        },
        { status: 400 }
      ),
    };
  }
}
