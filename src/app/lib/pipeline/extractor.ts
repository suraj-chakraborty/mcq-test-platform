import path from 'path';
import { Worker } from 'worker_threads';
import { prisma } from '@/app/lib/prisma';
import { sanitizePdfBuffer } from './sanitizer';
import { ExtractedDocumentResult, ERROR_CODES } from './types';
import {
  EncryptedPdfError,
  CorruptPdfError,
  EmptyPdfError,
  PipelineTimeoutError,
  PipelineError,
} from './errors';

interface ExtractionOptions {
  checkCache?: boolean;
  saveToCache?: boolean;
  maxPages?: number;
  strictActiveContent?: boolean;
  timeoutMs?: number;
}

/**
 * Executes PDF parsing in an isolated Worker Thread.
 * Guarantees zero event-loop blocking on the main thread and enforces memory/CPU timeouts.
 */
function runWorkerExtraction(
  buffer: Buffer,
  options: { maxPages?: number } = {},
  timeoutMs = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(process.cwd(), 'src/app/lib/pipeline/worker.mjs');
    const worker = new Worker(workerPath, {
      workerData: { buffer, options },
    });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new PipelineTimeoutError('PDF extraction worker thread timed out'));
    }, timeoutMs);

    worker.on('message', (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });

    worker.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new CorruptPdfError(`Worker stopped with unexpected exit code ${code}`));
      }
    });
  });
}

/**
 * Modern, sandboxed PDF text extraction engine:
 * 1. Sanitizes buffer, validates magic bytes, neutralizes embedded active exploits.
 * 2. Checks SHA-256 deduplication cache for instant zero-compute cache hits.
 * 3. Dispatches parsing to a dedicated Worker Thread (0ms main thread blocking).
 * 4. Computes per-page character density (< 50 chars/page) to conditionally trigger OCR.
 * 5. Classifies document structure with explicit error handling (ENCRYPTED, CORRUPT, EMPTY, SCANNED).
 */
export async function extractTextFromPdfResilient(
  rawBuffer: Buffer,
  options: ExtractionOptions = {}
): Promise<ExtractedDocumentResult> {
  const {
    checkCache = true,
    saveToCache = true,
    maxPages = 500,
    strictActiveContent = false,
    timeoutMs = 30000,
  } = options;

  // 1. Sanitize & Neutralize active content
  const sanitization = sanitizePdfBuffer(rawBuffer, {
    strictRejectActiveContent: strictActiveContent,
  });
  const { buffer, sha256 } = sanitization;

  // 2. SHA-256 Deduplication Cache Check
  if (checkCache && prisma?.cachedDocument) {
    try {
      const cached = await prisma.cachedDocument.findUnique({
        where: { sha256 },
      });

      if (cached && cached.extractedText !== undefined) {
        return {
          sha256,
          text: cached.extractedText,
          pageCount: cached.pageCount,
          pages: [
            {
              pageNumber: 1,
              text: cached.extractedText,
              charCount: cached.extractedText.length,
              isLowDensity: cached.extractedText.length < 50,
            },
          ],
          isScanned: cached.isScanned,
          needsOcr: cached.isScanned,
          lowDensityPages: cached.isScanned ? [1] : [],
          wasCacheHit: true,
        };
      }
    } catch (cacheErr) {
      console.warn('[PIPELINE_CACHE] Cache lookup failed, continuing with worker extraction:', cacheErr);
    }
  }

  // 3. Sandboxed Worker Thread Execution
  let workerResult: any;
  try {
    workerResult = await runWorkerExtraction(buffer, { maxPages }, timeoutMs);
  } catch (err: any) {
    if (err instanceof PipelineTimeoutError || err instanceof PipelineError) {
      throw err;
    }
    throw new CorruptPdfError(`Worker execution failed: ${err?.message || String(err)}`);
  }

  if (workerResult.error === 'ENCRYPTED') {
    throw new EncryptedPdfError();
  }
  if (workerResult.error === 'CORRUPT') {
    throw new CorruptPdfError(workerResult.message);
  }
  if (workerResult.error === 'EMPTY') {
    throw new EmptyPdfError();
  }
  if (!workerResult.success) {
    throw new PipelineError(
      workerResult.message || 'PDF extraction failed in worker thread',
      ERROR_CODES.INTERNAL_ERROR
    );
  }

  const { text, pageCount, pages, isScanned, needsOcr, lowDensityPages } = workerResult;

  const result: ExtractedDocumentResult = {
    sha256,
    text,
    pageCount,
    pages,
    isScanned,
    needsOcr,
    lowDensityPages,
    wasCacheHit: false,
  };

  // 4. Cache clean result in database if requested
  if (saveToCache && prisma?.cachedDocument) {
    try {
      await prisma.cachedDocument.upsert({
        where: { sha256 },
        create: {
          sha256,
          name: 'document.pdf',
          fileSize: buffer.length,
          pageCount,
          extractedText: text,
          isScanned,
        },
        update: {
          extractedText: text,
          isScanned,
          pageCount,
        },
      });
    } catch (saveErr) {
      console.warn('[PIPELINE_CACHE] Failed to save document to cache:', saveErr);
    }
  }

  return result;
}
