import {
  validatePdfBuffer,
  sanitizeFileName,
  MAX_PDF_SIZE_BYTES,
} from '@/app/lib/uploadValidation';
import fs from 'fs';
import path from 'path';
import { TextEncoder } from 'util';

describe('PDF Upload Validation & Sanitization', () => {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'pdf');

  describe('sanitizeFileName', () => {
    it('sanitizes standard clean filename', () => {
      expect(sanitizeFileName('biology_notes.pdf')).toBe('biology_notes.pdf');
    });

    it('strips path traversal sequences and slashes', () => {
      expect(sanitizeFileName('../../../etc/passwd')).toBe('passwd.pdf');
      expect(sanitizeFileName('..\\..\\Windows\\System32\\cmd.exe')).toBe('cmd.exe.pdf');
    });

    it('strips null bytes and illegal characters', () => {
      const malicious = 'exam\0_test<script>?*.pdf';
      const sanitized = sanitizeFileName(malicious);
      expect(sanitized).not.toContain('\0');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('*');
      expect(sanitized).toMatch(/^[a-zA-Z0-9_.-]+\.pdf$/);
    });

    it('ensures .pdf extension is always present', () => {
      expect(sanitizeFileName('sample_document')).toBe('sample_document.pdf');
      expect(sanitizeFileName('')).toBe('document.pdf');
    });

    it('handles undefined or non-string inputs safely', () => {
      expect(sanitizeFileName(undefined as any)).toBe('document.pdf');
      expect(sanitizeFileName(null as any)).toBe('document.pdf');
    });
  });

  describe('validatePdfBuffer', () => {
    it('accepts valid text-based PDF fixture', () => {
      const validPath = path.join(fixturesDir, 'text-based.pdf');
      const validBuffer = fs.readFileSync(validPath);

      const result = validatePdfBuffer(validBuffer, 'text-based.pdf');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.sanitizedFileName).toBe('text-based.pdf');
        expect(result.size).toBe(validBuffer.length);
      }
    });

    it('rejects empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validatePdfBuffer(emptyBuffer);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('EMPTY_FILE');
        expect(result.error).toContain('empty');
      }
    });

    it('rejects non-PDF files missing %PDF- magic bytes', () => {
      const textBuffer = Buffer.from('<html><body>This is an HTML file, not a PDF</body></html>');
      const result = validatePdfBuffer(textBuffer, 'fake.pdf');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_MAGIC_BYTES');
        expect(result.error).toContain('%PDF-');
      }
    });

    it('rejects encrypted and password-protected PDF fixtures with a clear error', () => {
      const encPath = path.join(fixturesDir, 'password-protected.pdf');
      const encBuffer = fs.readFileSync(encPath);

      const result = validatePdfBuffer(encBuffer, 'password-protected.pdf');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('ENCRYPTED_PDF');
        expect(result.error).toContain('password-protected or encrypted');
      }
    });

    it('rejects files exceeding the size cap', () => {
      // Mock buffer with valid %PDF- header but size cap set to 100 bytes
      const header = Buffer.from('%PDF-1.7\n');
      const largeContent = Buffer.alloc(200);
      const testBuffer = Buffer.concat([header, largeContent]);

      const result = validatePdfBuffer(testBuffer, 'oversized.pdf', 100);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe('FILE_TOO_LARGE');
        expect(result.error).toContain('exceeds maximum allowed limit');
      }
    });
  });

  describe('validateDirectPdfUploadByRange (Ranged Fetch Validation)', () => {
    const { validateDirectPdfUploadByRange } = require('@/app/lib/uploadValidation');

    it('validates remote PDF using HTTP Range request without full download', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 206,
        headers: new Headers({
          'content-range': 'bytes 0-2047/1048576',
        }),
        arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj').buffer,
      });
      global.fetch = mockFetch as any;

      const result = await validateDirectPdfUploadByRange(
        'https://res.cloudinary.com/demo/raw/upload/test.pdf',
        'test.pdf'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/raw/upload/test.pdf',
        expect.objectContaining({
          headers: { Range: 'bytes=0-2047' },
        })
      );
      expect(result.valid).toBe(true);
    });

    it('rejects remote direct upload if header bytes do not contain %PDF-', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 206,
        headers: new Headers({
          'content-range': 'bytes 0-2047/50000',
        }),
        arrayBuffer: async () => new TextEncoder().encode('<!DOCTYPE html><html><body>Not a PDF</body></html>').buffer,
      });
      global.fetch = mockFetch as any;

      const result = await validateDirectPdfUploadByRange(
        'https://res.cloudinary.com/demo/raw/upload/malicious.pdf',
        'malicious.pdf'
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_MAGIC_BYTES');
    });

    it('rejects remote direct upload if content-range reports size exceeding limit', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 206,
        headers: new Headers({
          'content-range': 'bytes 0-2047/100000000', // ~100MB
        }),
        arrayBuffer: async () => Buffer.from('%PDF-1.4\n').buffer,
      });
      global.fetch = mockFetch as any;

      const result = await validateDirectPdfUploadByRange(
        'https://res.cloudinary.com/demo/raw/upload/oversized.pdf',
        'oversized.pdf',
        50 * 1024 * 1024
      );

      expect(result.valid).toBe(false);
      expect(result.code).toBe('FILE_TOO_LARGE');
    });
  });
});
