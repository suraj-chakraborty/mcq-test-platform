import fs from 'fs';
import path from 'path';
import { sanitizePdfBuffer, computeSha256, hasValidPdfHeader } from '../lib/pipeline/sanitizer';
import { extractTextFromPdfResilient } from '../lib/pipeline/extractor';
import {
  EncryptedPdfError,
  CorruptPdfError,
  TooLargePdfError,
  PipelineError,
} from '../lib/pipeline/errors';
import { ERROR_CODES, JOB_STATUSES } from '../lib/pipeline/types';
import { NetlifyBackgroundRunner } from '../lib/pipeline/runner';
import { prisma } from '../lib/prisma';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'pdf');

function loadFixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES_DIR, name));
}

describe('Pipeline Checkpoint 1 (C1): Sanitization & Ingestion Security', () => {
  it('validates magic bytes and rejects non-PDF headers', () => {
    const invalidBuffer = Buffer.from('NOT_A_PDF_FILE_HEADER_123456');
    expect(hasValidPdfHeader(invalidBuffer)).toBe(false);
    expect(() => sanitizePdfBuffer(invalidBuffer)).toThrow(CorruptPdfError);
  });

  it('rejects empty buffers', () => {
    expect(() => sanitizePdfBuffer(Buffer.alloc(0))).toThrow(CorruptPdfError);
  });

  it('rejects buffers exceeding 50 MB limit', () => {
    const fakeHugeBuffer = Buffer.alloc(51 * 1024 * 1024);
    fakeHugeBuffer.write('%PDF-1.4');
    expect(() => sanitizePdfBuffer(fakeHugeBuffer)).toThrow(TooLargePdfError);
  });

  it('neutralizes active PDF content without shifting byte length', () => {
    const fixture = loadFixture('embedded-js-attachments.pdf');
    const originalLen = fixture.length;
    const result = sanitizePdfBuffer(fixture);

    expect(result.isValidPdf).toBe(true);
    expect(result.hasActiveContent).toBe(true);
    expect(result.neutralizedThreats.length).toBeGreaterThan(0);
    // Crucial: byte length preserved to protect xref tables
    expect(result.buffer.length).toBe(originalLen);

    const neutralizedStr = result.buffer.toString('binary');
    expect(neutralizedStr.includes('/JavaScript')).toBe(false);
    expect(neutralizedStr.includes('/EmbeddedFiles')).toBe(false);
  });

  it('computes deterministic SHA-256 digests', () => {
    const buf = Buffer.from('%PDF-1.4 test document');
    const digest1 = computeSha256(buf);
    const digest2 = computeSha256(buf);
    expect(digest1).toBe(digest2);
    expect(digest1.length).toBe(64);
  });
});

describe('Pipeline Checkpoint 1 (C1): Resilient PDF Extractor & Fixtures Matrix', () => {
  it('throws EncryptedPdfError (code ENCRYPTED) on password-protected PDF', async () => {
    const fixture = loadFixture('password-protected.pdf');
    await expect(extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false }))
      .rejects.toThrow(EncryptedPdfError);

    try {
      await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });
    } catch (err: any) {
      expect(err.code).toBe(ERROR_CODES.ENCRYPTED);
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws CorruptPdfError (code CORRUPT) on truncated/corrupted PDF', async () => {
    const fixture = loadFixture('corrupted-truncated.pdf');
    await expect(extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false }))
      .rejects.toThrow(CorruptPdfError);

    try {
      await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });
    } catch (err: any) {
      expect(err.code).toBe(ERROR_CODES.CORRUPT);
    }
  });

  it('detects scanned-image-only PDF requiring OCR fallback', async () => {
    const fixture = loadFixture('scanned-image-only.pdf');
    const result = await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });

    expect(result.pageCount).toBe(1);
    expect(result.text.length).toBe(0);
    expect(result.isScanned).toBe(true);
    expect(result.needsOcr).toBe(true);
    expect(result.lowDensityPages).toContain(1);
  });

  it('extracts tiny 1-character PDF accurately without false scanned classification', async () => {
    const fixture = loadFixture('tiny.pdf');
    const result = await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain('A');
    // A single page with single char should NOT be classified as scanned
    expect(result.isScanned).toBe(false);
  });

  it('extracts text cleanly from text-based fixture', async () => {
    const fixture = loadFixture('text-based.pdf');
    const result = await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain('Cellular Biology');
    expect(result.text).toContain('Mitochondria');
    expect(result.isScanned).toBe(false);
  });

  it('extracts non-English Indic script (Hindi) accurately', async () => {
    const fixture = loadFixture('non-english-indic.pdf');
    const result = await extractTextFromPdfResilient(fixture, { checkCache: false, saveToCache: false });

    expect(result.pageCount).toBe(1);
    expect(result.text.length).toBeGreaterThan(50);
    expect(result.isScanned).toBe(false);
  });

  it('processes large 500-page document within performance bounds', async () => {
    const fixture = loadFixture('large-500-pages.pdf');
    const start = Date.now();
    const result = await extractTextFromPdfResilient(fixture, {
      checkCache: false,
      saveToCache: false,
      maxPages: 50, // Test first 50 pages to keep unit test snappy
    });
    const duration = Date.now() - start;

    expect(result.pageCount).toBe(50);
    expect(result.text.length).toBeGreaterThan(1000);
    expect(duration).toBeLessThan(10000); // Must complete well within 10s
  });

  it('returns cache hit when SHA-256 match exists in database', async () => {
    const fixture = loadFixture('text-based.pdf');
    const sha256 = computeSha256(fixture);

    // Mock Prisma cachedDocument
    const originalFindUnique = prisma.cachedDocument.findUnique;
    prisma.cachedDocument.findUnique = jest.fn().mockResolvedValue({
      sha256,
      extractedText: 'Pre-cached high-yield textbook syllabus text content.',
      pageCount: 15,
      isScanned: false,
    } as any);

    const result = await extractTextFromPdfResilient(fixture, { checkCache: true, saveToCache: false });

    expect(result.wasCacheHit).toBe(true);
    expect(result.text).toBe('Pre-cached high-yield textbook syllabus text content.');
    expect(result.pageCount).toBe(15);

    prisma.cachedDocument.findUnique = originalFindUnique;
  });
});

describe('Pipeline Checkpoint 1 (C1): Job Runner & State Transitions', () => {
  let runner: NetlifyBackgroundRunner;

  beforeEach(() => {
    runner = new NetlifyBackgroundRunner();
  });

  it('enqueues job in QUEUED status in < 200ms', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const fakeJobId = '607f1f77bcf86cd799439022';

    // Mock prisma job create
    const originalCreate = prisma.job.create;
    prisma.job.create = jest.fn().mockResolvedValue({
      id: fakeJobId,
      userId: fakeUserId,
      status: JOB_STATUSES.QUEUED,
      progress: 0,
    } as any);

    const start = Date.now();
    const result = await runner.enqueue({
      userId: fakeUserId,
      title: 'Biology Chapter 1',
      topic: 'Cell Biology',
      numQuestions: 10,
      contextPDFs: [{ name: 'bio.pdf', url: 'https://example.com/bio.pdf' }],
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
    expect(result.jobId).toBe(fakeJobId);
    expect(result.status).toBe(JOB_STATUSES.QUEUED);

    prisma.job.create = originalCreate;
  });

  it('returns existing in-flight job if idempotency key matches', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const existingId = '607f1f77bcf86cd799439033';

    const originalFindFirst = prisma.job.findFirst;
    prisma.job.findFirst = jest.fn().mockResolvedValue({
      id: existingId,
      status: JOB_STATUSES.EXTRACTING,
    } as any);

    const result = await runner.enqueue({
      userId: fakeUserId,
      idempotencyKey: 'idemp-duplicate-test-key-123',
      title: 'Chemistry Test',
      contextPDFs: [{ name: 'chem.pdf', url: 'https://example.com/chem.pdf' }],
    });

    expect(result.jobId).toBe(existingId);
    expect(result.status).toBe(JOB_STATUSES.EXTRACTING);

    prisma.job.findFirst = originalFindFirst;
  });

  it('allows user to cancel an in-flight job', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const fakeJobId = '607f1f77bcf86cd799439044';

    const originalFindUnique = prisma.job.findUnique;
    const originalUpdate = prisma.job.update;

    prisma.job.findUnique = jest.fn().mockResolvedValue({
      id: fakeJobId,
      userId: fakeUserId,
      status: JOB_STATUSES.GENERATING,
    } as any);

    prisma.job.update = jest.fn().mockResolvedValue({
      id: fakeJobId,
      status: JOB_STATUSES.CANCELLED,
    } as any);

    const success = await runner.cancelJob(fakeJobId, fakeUserId);
    expect(success).toBe(true);

    prisma.job.findUnique = originalFindUnique;
    prisma.job.update = originalUpdate;
  });
});
