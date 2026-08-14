import { NextResponse } from 'next/server';
import { generateMCQsUniversal } from '@/app/lib/ai';
import { prisma } from '@/app/lib/prisma';
import { saveFile } from '@/app/lib/fileStorage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const maxDuration = 60; // Extended for large scanned PDFs

async function safeGenerateMCQs(
  buffer: Buffer,
  text: string,
  isScanned: boolean,
  topic: string,
  numQuestions: number,
  timeoutMs = 45000
): Promise<any[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await generateMCQsUniversal({
      pdfBuffer: buffer,
      pdfText: text,
      isScanned,
      topic,
      numQuestions,
    });
    return result;
  } catch (err) {
    console.warn('MCQ generation failed or timed out:', err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const topic = formData.get('domainTopic')?.toString() || 'General';
    const numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10', 10);

    const uploadDir = path.join('/tmp', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      // Ignored for environments where /tmp isn't writeable directly
    }

    const results = await Promise.allSettled(
      files.map(async (file) => {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          throw new Error(`File ${file.name} is not a PDF`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File ${file.name} exceeds maximum size of 25MB`);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileUrl = await saveFile(file);
        const { text, pageCount, isScanned } = await extractTextFromPdf(buffer);
        const mcqs = await safeGenerateMCQs(buffer, text, isScanned, topic, numQuestions);

        // Create Test + Questions with Proof Citations + PdfDocument
        const test = await prisma.test.create({
          data: {
            userId: session.user.id,
            title: file.name.replace(/\.pdf$/i, ''),
            description: `Test generated from ${file.name} (Topic: ${topic})`,
            duration: 30,
            questions: {
              create: mcqs.map((q: any) => ({
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || '',
                difficulty: q.difficulty || 'medium',
                proofQuote: q.proofQuote || '',
                pageReference: q.pageReference || 'Document Reference',
                citationType: q.citationType || 'VERBATIM_PROOF',
              })),
            },
            pdfs: {
              create: [
                {
                  name: file.name,
                  url: fileUrl,
                  fileSize: file.size,
                  pageCount: pageCount,
                },
              ],
            },
          },
          include: {
            pdfs: true,
            questions: true,
          },
        });

        return {
          test,
          mcqs: test.questions,
        };
      })
    );

    const processedTests = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results.filter((r) => r.status === 'rejected');

    return NextResponse.json({
      success: true,
      tests: processedTests.map((t) => ({
        id: t.test.id,
        title: t.test.title,
        pdfUrl: t.test.pdfs[0]?.url,
      })),
      mcqs: processedTests.flatMap((p) => p.mcqs),
      errors: failed.map((e, idx) => ({
        index: idx,
        reason: (e as PromiseRejectedResult).reason?.message || 'Unknown error',
      })),
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
