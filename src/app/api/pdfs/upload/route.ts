import { NextResponse } from 'next/server';
import { generateMCQsUniversal } from '@/app/lib/ai';
import { prisma } from '@/app/lib/prisma';
import { saveFile } from '@/app/lib/fileStorage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for Cloudinary-hosted PDFs
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

    const contentType = request.headers.get('content-type') || '';
    let filesToProcess: { name: string; url?: string; buffer?: Buffer; fileSize: number }[] = [];
    let topic = 'General';
    let numQuestions = 10;

    if (contentType.includes('application/json')) {
      // 1. Direct Cloudinary Upload Flow (Zero Netlify payload size limitation)
      const body = await request.json();
      topic = body.domainTopic || 'General';
      numQuestions = parseInt(body.numQuestions || '10', 10);

      const directUploads = body.directUploads as { name: string; url: string; fileSize?: number }[];
      if (!directUploads || directUploads.length === 0) {
        return NextResponse.json({ error: 'No uploaded PDF URLs provided' }, { status: 400 });
      }

      filesToProcess = directUploads.map((u) => ({
        name: u.name,
        url: u.url,
        fileSize: u.fileSize || 0,
      }));
    } else {
      // 2. Standard FormData Flow (Localhost / Fallback)
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      }

      topic = formData.get('domainTopic')?.toString() || 'General';
      numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10', 10);

      for (const file of files) {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          return NextResponse.json({ error: `File ${file.name} is not a PDF` }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: `File ${file.name} exceeds maximum allowed size` }, { status: 400 });
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileUrl = await saveFile(file);
        filesToProcess.push({
          name: file.name,
          url: fileUrl,
          buffer,
          fileSize: file.size,
        });
      }
    }

    // Process each PDF file
    const results = await Promise.allSettled(
      filesToProcess.map(async (fileItem) => {
        let buffer = fileItem.buffer;
        let fileUrl = fileItem.url || '';

        // If buffer was not passed directly, fetch it from Cloudinary CDN
        if (!buffer && fileUrl) {
          const res = await fetch(fileUrl);
          if (!res.ok) {
            throw new Error(`Failed to download PDF from Cloudinary (${res.status})`);
          }
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        }

        if (!buffer) {
          throw new Error(`No document content available for ${fileItem.name}`);
        }

        const { text, pageCount, isScanned } = await extractTextFromPdf(buffer);
        const mcqs = await safeGenerateMCQs(buffer, text, isScanned, topic, numQuestions);

        // Create Test + Questions with Proof Citations + PdfDocument in database
        const test = await prisma.test.create({
          data: {
            userId: session.user.id,
            title: fileItem.name.replace(/\.pdf$/i, ''),
            description: `Test generated from ${fileItem.name} (Topic: ${topic})`,
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
                  name: fileItem.name,
                  url: fileUrl,
                  fileSize: fileItem.fileSize || buffer.length,
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

    if (processedTests.length === 0 && failed.length > 0) {
      const firstError = (failed[0] as PromiseRejectedResult).reason?.message || 'Failed to process document';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

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
    console.error('Upload processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
