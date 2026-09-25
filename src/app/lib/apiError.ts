import { NextResponse } from 'next/server';
import crypto from 'crypto';

export interface ApiErrorEnvelope {
  error: string;
  code: string;
  message: string;
  requestId: string;
  errorDetails: {
    code: string;
    message: string;
    requestId: string;
  };
}

/**
 * Masks sensitive PII (passwords, tokens, API keys, emails, MongoDB URIs, secret keys)
 * in server logs and exception traces to prevent information disclosure.
 */
export function maskSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]')
    .replace(/(password|secret|token|apiKey|api_key|otp|auth)[=:\s]+[^\s,;&"']+/gi, '$1=[REDACTED]')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, 'mongodb://[REDACTED_URI]');
}

/**
 * Standardized API error response helper.
 * Eliminates internal exception leakage (SEC-013) by returning safe, human-readable
 * error messages to the client while logging masked error diagnostics on the server.
 */
export function createApiErrorResponse(
  status: number,
  code: string,
  userMessage: string,
  internalError?: unknown,
  req?: Request
): NextResponse<ApiErrorEnvelope> {
  const requestId = req?.headers.get('x-request-id') || crypto.randomUUID();

  // Log detailed error internally on the server (with PII & credential redaction)
  if (internalError) {
    const rawMsg = internalError instanceof Error ? internalError.message : String(internalError);
    const stack = internalError instanceof Error ? internalError.stack : undefined;
    console.error(`[API_ERROR][${requestId}][${code}]:`, maskSensitiveData(rawMsg));
    if (process.env.NODE_ENV !== 'production' && stack) {
      console.error(`[API_STACK][${requestId}]:`, maskSensitiveData(stack));
    }
  }

  return NextResponse.json(
    {
      error: userMessage,
      code,
      message: userMessage,
      requestId,
      errorDetails: {
        code,
        message: userMessage,
        requestId,
      },
    },
    { status }
  );
}
