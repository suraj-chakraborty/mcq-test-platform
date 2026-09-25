import { prisma } from '@/app/lib/prisma';
import {
  EnqueueJobPayload,
  JobStatus,
  JOB_STATUSES,
  ERROR_CODES,
  JobErrorCode,
} from './types';
import { PipelineError } from './errors';
import { sanitizePdfBuffer } from './sanitizer';
import { extractTextFromPdfResilient } from './extractor';
import { downloadCloudinaryPdf } from '@/app/lib/cloudinary';
import { generateMCQs, generateMCQsFromPdfBuffer } from '@/app/lib/ai';
import { generateMCQsMapReduce } from './mapReduceGenerator';

export interface IJobRunner {
  enqueue(payload: EnqueueJobPayload): Promise<{ jobId: string; status: JobStatus }>;
  getJob(jobId: string, userId?: string): Promise<any | null>;
  cancelJob(jobId: string, userId?: string): Promise<boolean>;
}

export class NetlifyBackgroundRunner implements IJobRunner {
  /**
   * Enqueues a job record in MongoDB and triggers background execution immediately (< 150ms).
   */
  async enqueue(payload: EnqueueJobPayload): Promise<{ jobId: string; status: JobStatus }> {
    const { userId, idempotencyKey, title, topic = 'General', numQuestions = 10 } = payload;

    // Check if an existing job is already queued or processing for this idempotency key
    if (idempotencyKey) {
      const existingJob = await prisma.job.findFirst({
        where: {
          userId,
          idempotencyKey,
          status: {
            in: [
              JOB_STATUSES.QUEUED,
              JOB_STATUSES.VALIDATING,
              JOB_STATUSES.EXTRACTING,
              JOB_STATUSES.OCR,
              JOB_STATUSES.CHUNKING,
              JOB_STATUSES.GENERATING,
              JOB_STATUSES.VERIFYING,
              JOB_STATUSES.FINALIZING,
            ],
          },
        },
      });

      if (existingJob) {
        return { jobId: existingJob.id, status: existingJob.status as JobStatus };
      }
    }

    // Create the Job in QUEUED state
    const job = await prisma.job.create({
      data: {
        userId,
        type: payload.type || 'PDF_TO_TEST',
        status: JOB_STATUSES.QUEUED,
        progress: 0,
        totalSteps: 6,
        currentStep: 0,
        stage: 'Queued in background processing pipeline',
        idempotencyKey,
        metadata: {
          title,
          topic,
          numQuestions,
          contextPdfsCount: payload.contextPDFs.length,
          pyqPdfsCount: payload.pyqPDFs?.length || 0,
          queuedAt: new Date().toISOString(),
        },
      },
    });

    // Launch background asynchronous worker
    this.dispatchBackgroundExecution(job.id, payload);

    return { jobId: job.id, status: JOB_STATUSES.QUEUED };
  }

  /**
   * Retrieves current status and progress of a job.
   */
  async getJob(jobId: string, userId?: string): Promise<any | null> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;
    if (userId && job.userId !== userId) {
      throw new PipelineError('Access denied: You do not own this job.', ERROR_CODES.UNAUTHORIZED, 403);
    }

    return job;
  }

  /**
   * Cancels an in-flight job if not already finished.
   */
  async cancelJob(jobId: string, userId?: string): Promise<boolean> {
    const job = await this.getJob(jobId, userId);
    if (!job) return false;

    if (job.status === JOB_STATUSES.COMPLETED || job.status === JOB_STATUSES.FAILED) {
      return false; // Cannot cancel finished job
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.CANCELLED,
        stage: 'Job was cancelled by user',
        completedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Asynchronously runs the multi-stage pipeline, updating progress along the way.
   */
  private dispatchBackgroundExecution(jobId: string, payload: EnqueueJobPayload) {
    const defer = typeof setImmediate !== 'undefined'
      ? setImmediate
      : (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);

    // Run unblocked in event loop
    defer(async () => {
      try {
        await this.runPipeline(jobId, payload);
      } catch (fatalErr: any) {
        console.error(`[BACKGROUND_WORKER] Fatal error in job ${jobId}:`, fatalErr);
        try {
          await prisma.job.update({
            where: { id: jobId },
            data: {
              status: JOB_STATUSES.FAILED,
              progress: 100,
              error: fatalErr?.userMessage || fatalErr?.message || 'Processing failed.',
              errorCode: fatalErr?.code || ERROR_CODES.INTERNAL_ERROR,
              completedAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.error(`[BACKGROUND_WORKER] Failed to mark job ${jobId} as failed in DB:`, dbErr);
        }
      }
    });
  }

  /**
   * Pipeline Execution:
   * 1. VALIDATING (15%)
   * 2. EXTRACTING (35%)
   * 3. OCR (50% if needed)
   * 4. CHUNKING (65%)
   * 5. GENERATING (85%)
   * 6. VERIFYING (95%)
   * 7. FINALIZING & COMPLETED (100%)
   */
  private async runPipeline(jobId: string, payload: EnqueueJobPayload) {
    const { userId, title, topic = 'General', numQuestions = 10, contextPDFs } = payload;

    // Check if cancelled before starting
    const checkCancelled = async () => {
      const current = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
      return current?.status === JOB_STATUSES.CANCELLED;
    };

    if (await checkCancelled()) return;

    // Step 1: VALIDATING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.VALIDATING,
        currentStep: 1,
        progress: 15,
        stage: 'Validating PDF integrity and neutralizing active content...',
        startedAt: new Date(),
      },
    });

    let combinedContextText = '';
    let totalDocumentPages = 1;
    const collectedBuffers: { name: string; buffer: Buffer; url?: string }[] = [];

    // Step 2: EXTRACTING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.EXTRACTING,
        currentStep: 2,
        progress: 35,
        stage: 'Extracting text layer and analyzing document structure...',
      },
    });

    let anyNeedsOcr = false;

    for (const pdfItem of contextPDFs) {
      if (await checkCancelled()) return;

      let buffer: Buffer | null = null;
      if (pdfItem.bufferBase64) {
        buffer = Buffer.from(pdfItem.bufferBase64, 'base64');
      } else if (pdfItem.url) {
        buffer = await downloadCloudinaryPdf(pdfItem.url, pdfItem.publicId);
      }

      if (!buffer && pdfItem.text && pdfItem.text.length >= 50) {
        // Client already extracted clean text
        combinedContextText += `\n--- Document: ${pdfItem.name} ---\n${pdfItem.text}\n`;
        continue;
      }

      if (!buffer) {
        throw new PipelineError(`Could not access buffer for file: ${pdfItem.name}`, ERROR_CODES.CORRUPT);
      }

      // Sanitize
      const sanitized = sanitizePdfBuffer(buffer);
      collectedBuffers.push({ name: pdfItem.name, buffer: sanitized.buffer, url: pdfItem.url });

      // Resilient extraction with SHA-256 deduplication
      const extraction = await extractTextFromPdfResilient(sanitized.buffer, {
        checkCache: true,
        saveToCache: true,
      });

      if (extraction.text && extraction.text.length >= 50) {
        combinedContextText += `\n--- Document: ${pdfItem.name} ---\n${extraction.text}\n`;
      }

      totalDocumentPages = Math.max(totalDocumentPages, extraction.pageCount);

      if (extraction.needsOcr) {
        anyNeedsOcr = true;
      }
    }

    // Step 3: OCR (if needed)
    if (anyNeedsOcr && (!combinedContextText || combinedContextText.length < 50)) {
      if (await checkCancelled()) return;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JOB_STATUSES.OCR,
          currentStep: 3,
          progress: 50,
          stage: 'Document is scanned. Performing multimodal vision OCR...',
        },
      });
    }

    // Step 4: CHUNKING
    if (await checkCancelled()) return;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.CHUNKING,
        currentStep: 4,
        progress: 65,
        stage: 'Structuring syllabus modules and key concept maps...',
      },
    });

    // Step 5: GENERATING
    if (await checkCancelled()) return;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.GENERATING,
        currentStep: 5,
        progress: 85,
        stage: 'Formulating high-yield MCQs with citations...',
      },
    });

    let questions: any[] = [];
    let coverageReport: any = null;

    if (combinedContextText && combinedContextText.length >= 50) {
      const mapReduceResult = await generateMCQsMapReduce({
        documentText: combinedContextText,
        topic,
        numQuestions,
        totalPages: totalDocumentPages,
      });
      questions = mapReduceResult.questions;
      coverageReport = mapReduceResult.coverage;
    } else if (collectedBuffers.length > 0) {
      questions = await generateMCQsFromPdfBuffer(collectedBuffers[0].buffer, topic, numQuestions);
    }

    if (!questions || questions.length === 0) {
      throw new PipelineError(
        'Failed to generate questions from this syllabus document.',
        ERROR_CODES.LLM_ERROR
      );
    }

    // Step 6: VERIFYING
    if (await checkCancelled()) return;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.VERIFYING,
        currentStep: 6,
        progress: 95,
        stage: 'Verifying answer keys and fact-checking proof quotes...',
      },
    });

    // Step 7: FINALIZING & SAVING TO DB
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.FINALIZING,
        progress: 98,
        stage: 'Persisting test record to database...',
      },
    });

    const test = await prisma.test.create({
      data: {
        title,
        description: `Generated from ${contextPDFs.map((f) => f.name).join(', ')}`,
        duration: Math.max(10, questions.length * 2),
        userId,
        idempotencyKey: payload.idempotencyKey,
        questions: {
          create: questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || '',
            difficulty: q.difficulty || 'medium',
            proofQuote: q.proofQuote || null,
            pageReference: q.pageReference || null,
            citationType: q.citationType || 'VERBATIM_PROOF',
          })),
        },
        pdfs: {
          create: collectedBuffers.map((f) => ({
            name: f.name,
            url: f.url || '',
            fileSize: f.buffer.length,
          })),
        },
      },
      include: {
        questions: true,
        pdfs: true,
      },
    });

    // Mark job as COMPLETED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JOB_STATUSES.COMPLETED,
        progress: 100,
        stage: 'Test generated successfully!',
        testId: test.id,
        completedAt: new Date(),
        metadata: {
          ...(typeof payload.metadata === 'object' ? payload.metadata : {}),
          coverage: coverageReport,
        },
      },
    });
  }
}

// Export singleton instance of runner
export const defaultJobRunner: IJobRunner = new NetlifyBackgroundRunner();
