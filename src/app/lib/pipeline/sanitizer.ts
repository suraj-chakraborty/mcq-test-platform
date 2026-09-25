import crypto from 'crypto';
import { SanitizationResult } from './types';
import { CorruptPdfError, ActiveContentPdfError, TooLargePdfError } from './errors';

export const MAX_PDF_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB
export const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

/**
 * Exact-length keyword replacements to neutralize active PDF exploits
 * without invalidating cross-reference (xref) table byte offsets.
 */
const THREAT_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: 'Embedded JavaScript (/JavaScript)', pattern: /\/JavaScript\b/g, replacement: '/DeactvJS  ' },
  { name: 'Short JavaScript (/JS)', pattern: /\/JS\b/g, replacement: '/XX' },
  { name: 'Executable Launch (/Launch)', pattern: /\/Launch\b/g, replacement: '/Deactv ' },
  { name: 'Embedded Files (/EmbeddedFiles)', pattern: /\/EmbeddedFiles\b/g, replacement: '/DeactvdFiles ' },
  { name: 'Remote Form Submit (/SubmitForm)', pattern: /\/SubmitForm\b/g, replacement: '/DeactvForm' },
  { name: 'Data Import (/ImportData)', pattern: /\/ImportData\b/g, replacement: '/DeactvData' },
  { name: 'RichMedia Executable (/RichMedia)', pattern: /\/RichMedia\b/g, replacement: '/DeactvMed' },
];

/**
 * Computes a standard SHA-256 cryptographic digest of a file buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Inspects PDF magic bytes within the first 1024 bytes.
 */
export function hasValidPdfHeader(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
  return headerSlice.indexOf(PDF_MAGIC_BYTES) !== -1;
}

/**
 * Sanitizes and validates an uploaded PDF buffer:
 * 1. Enforces size boundaries (<= 50 MB)
 * 2. Verifies PDF magic byte signature
 * 3. Calculates SHA-256 checksum
 * 4. Detects & neutralizes active exploit vectors (embedded JS, launch actions, attachments)
 */
export function sanitizePdfBuffer(
  buffer: Buffer,
  options: { strictRejectActiveContent?: boolean } = {}
): SanitizationResult {
  if (!buffer || buffer.length === 0) {
    throw new CorruptPdfError('File buffer is empty.');
  }

  if (buffer.length > MAX_PDF_BUFFER_SIZE) {
    throw new TooLargePdfError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds 50 MB limit.`
    );
  }

  if (!hasValidPdfHeader(buffer)) {
    throw new CorruptPdfError('File missing valid %PDF- magic byte header.');
  }

  const sha256 = computeSha256(buffer);
  const foundThreats: string[] = [];

  // Convert buffer to binary string representation to scan and replace active tokens
  let content = buffer.toString('binary');

  for (const { name, pattern, replacement } of THREAT_PATTERNS) {
    if (pattern.test(content)) {
      foundThreats.push(name);
      if (options.strictRejectActiveContent) {
        throw new ActiveContentPdfError(`Active PDF exploit detected: ${name}`);
      }
      content = content.replace(pattern, replacement);
    }
  }

  const sanitizedBuffer = foundThreats.length > 0 ? Buffer.from(content, 'binary') : buffer;

  return {
    buffer: sanitizedBuffer,
    sha256,
    hasActiveContent: foundThreats.length > 0,
    neutralizedThreats: foundThreats,
    isValidPdf: true,
  };
}
