import path from 'path';
import { validateSafeUrl } from '@/app/lib/ssrf';

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB size cap

export interface ValidationSuccess {
  valid: true;
  sanitizedFileName: string;
  size: number;
}

export interface ValidationFailure {
  valid: false;
  error: string;
  code: 'INVALID_MAGIC_BYTES' | 'FILE_TOO_LARGE' | 'ENCRYPTED_PDF' | 'EMPTY_FILE';
}

export type UploadValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Sanitizes a filename:
 * - Removes path traversal sequences and directory separators
 * - Strips control characters and illegal symbols
 * - Enforces .pdf extension
 * - Constrains length
 */
export function sanitizeFileName(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'document.pdf';
  }

  // Strip path traversal attempts and extract basename
  const normalized = rawName.trim().replace(/\\/g, '/');
  const base = path.basename(normalized);

  // Strip control characters, null bytes, and filesystem-reserved characters
  let cleaned = base.replace(/[\0\x00-\x1f\x7f<>:"/\\|?*]/g, '_').trim();

  // Strip leading dots to avoid hidden files or path traversal tricks
  cleaned = cleaned.replace(/^\.+/, '');

  if (!cleaned.toLowerCase().endsWith('.pdf')) {
    cleaned = `${cleaned}.pdf`;
  }

  // Limit filename length to 120 chars while keeping .pdf extension
  if (cleaned.length > 120) {
    const ext = '.pdf';
    cleaned = cleaned.slice(0, 120 - ext.length) + ext;
  }

  return cleaned || 'document.pdf';
}

/**
 * Validates a PDF buffer:
 * 1. Checks non-empty buffer
 * 2. Checks size cap (50MB)
 * 3. Checks %PDF- magic bytes within the first 1024 bytes (standard PDF spec)
 * 4. Checks for PDF encryption (/Encrypt dictionary) and rejects with a clear error
 */
export function validatePdfBuffer(
  buffer: Buffer,
  fileName: string = 'document.pdf',
  maxBytes: number = MAX_PDF_SIZE_BYTES
): UploadValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'The uploaded file is empty.',
      code: 'EMPTY_FILE',
    };
  }

  if (buffer.length > maxBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
      code: 'FILE_TOO_LARGE',
    };
  }

  // PDF Magic Bytes: Must contain %PDF- in the header (first 1024 bytes per PDF spec)
  const headerSlice = buffer.slice(0, Math.min(1024, buffer.length)).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    return {
      valid: false,
      error: 'Invalid file format: File missing "%PDF-" magic header bytes. Only valid PDF files are accepted.',
      code: 'INVALID_MAGIC_BYTES',
    };
  }

  // Reject Encrypted / Password Protected PDFs
  // Standard PDF spec specifies encryption via the /Encrypt dictionary in the trailer / cross-reference dictionary
  const hasEncryptMarker =
    buffer.includes(Buffer.from('/Encrypt')) ||
    /\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(buffer.toString('latin1', 0, Math.min(buffer.length, 65536))) ||
    /\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(buffer.toString('latin1', Math.max(0, buffer.length - 65536)));

  if (hasEncryptMarker) {
    return {
      valid: false,
      error: 'The uploaded PDF is password-protected or encrypted. Please remove password encryption and re-upload.',
      code: 'ENCRYPTED_PDF',
    };
  }

  return {
    valid: true,
    sanitizedFileName: sanitizeFileName(fileName),
    size: buffer.length,
  };
}

/**
 * Validates a direct remote upload (e.g. Cloudinary) using an HTTP Ranged fetch.
 * Reads ONLY the first 2048 bytes of the file, never performing a full download.
 */
export async function validateDirectPdfUploadByRange(
  url: string,
  fileName: string = 'document.pdf',
  maxBytes: number = MAX_PDF_SIZE_BYTES
): Promise<UploadValidationResult> {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'Invalid or missing upload URL.',
      code: 'EMPTY_FILE',
    };
  }

  const urlCheck = validateSafeUrl(url, { requireCloudinaryCloudName: true });
  if (!urlCheck.valid) {
    return {
      valid: false,
      error: `Remote upload rejected: ${urlCheck.error}`,
      code: 'INVALID_MAGIC_BYTES',
    };
  }

  try {
    const res = await fetch(urlCheck.url.toString(), {
      method: 'GET',
      headers: {
        Range: 'bytes=0-2047',
      },
    });

    if (!res.ok && res.status !== 206) {
      return {
        valid: false,
        error: `Could not verify remote upload: HTTP ${res.status}`,
        code: 'INVALID_MAGIC_BYTES',
      };
    }

    // Check Content-Range or Content-Length for size cap
    const contentRange = res.headers.get('content-range'); // e.g. "bytes 0-2047/10485760"
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match && parseInt(match[1], 10) > maxBytes) {
        const sizeMb = (parseInt(match[1], 10) / (1024 * 1024)).toFixed(1);
        const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
        return {
          valid: false,
          error: `File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
          code: 'FILE_TOO_LARGE',
        };
      }
    }

    // Read only the first chunk from the stream and cancel the stream
    let buffer: Buffer;
    if (res.body && typeof (res.body as any).getReader === 'function') {
      const reader = (res.body as any).getReader();
      const { value } = await reader.read();
      reader.cancel().catch(() => {});
      buffer = value ? Buffer.from(value) : Buffer.alloc(0);
    } else {
      buffer = Buffer.from(await res.arrayBuffer());
    }

    if (buffer.length === 0) {
      return {
        valid: false,
        error: 'The uploaded file is empty.',
        code: 'EMPTY_FILE',
      };
    }

    // PDF Magic Bytes: Must contain %PDF- in the header (first 1024 bytes per PDF spec)
    const headerSlice = buffer.slice(0, Math.min(1024, buffer.length)).toString('latin1');
    if (!headerSlice.includes('%PDF-')) {
      return {
        valid: false,
        error: 'Invalid file format: File missing "%PDF-" magic header bytes. Only valid PDF files are accepted.',
        code: 'INVALID_MAGIC_BYTES',
      };
    }

    return {
      valid: true,
      sanitizedFileName: sanitizeFileName(fileName),
      size: buffer.length,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Network error verifying remote upload: ${error?.message || 'Connection failed'}`,
      code: 'INVALID_MAGIC_BYTES',
    };
  }
}

