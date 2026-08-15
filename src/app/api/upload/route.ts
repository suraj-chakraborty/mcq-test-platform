export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import pdfParse from 'pdf-parse';
import { saveFile } from '@/app/lib/fileStorage';
import { downloadCloudinaryPdf } from '@/app/lib/cloudinary';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { generateMCQs, generateMCQsFromPdfBuffer } from '@/app/lib/ai';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    let fileName = 'document.pdf';
    let fileUrl = '';
    let publicId = '';
    let buffer: Buffer | null = null;
    let fileSize = 0;
    let topic = 'General';
    let numQuestions = 10;
    let extractedText = '';
    let pageCount = 1;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      fileUrl = body.pdfUrl || body.url || '';
      publicId = body.publicId || '';
      fileName = body.fileName || body.name || 'document.pdf';
      fileSize = body.fileSize || 0;
      topic = body.domainTopic || body.topic || 'General';
      numQuestions = parseInt(body.numQuestions || '10', 10);
      extractedText = body.text || '';
      pageCount = body.pageCount || 1;

      if (!fileUrl) {
        return NextResponse.json({ error: 'No PDF URL provided' }, { status: 400 });
      }

      // If client provided text layer, we don't need to download buffer unless empty
      if (!extractedText || extractedText.length < 50) {
        try {
          buffer = await downloadCloudinaryPdf(fileUrl, publicId);
        } catch (e) {
          console.warn('Could not download buffer for upload route:', e);
        }
      }
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      topic = formData.get('domainTopic')?.toString() || 'General';
      numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10', 10);

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      fileSize = file.size;
      fileUrl = await saveFile(file);
    }

    if (buffer && (!extractedText || extractedText.length < 50)) {
      try {
        const { text, pageCount: pc } = await extractTextFromPdf(buffer);
        extractedText = text;
        pageCount = pc;
      } catch (e) {
        console.log('PDF text extraction failed. Falling back to Gemini Vision OCR.', e);
        try {
          const data = await pdfParse(buffer);
          pageCount = data.numpages || 1;
        } catch (innerE) {
          console.warn('Could not determine page count, defaulting to 1.');
        }
      }
    }

    let mcqs: any[] = [];

    if (extractedText && extractedText.length >= 50) {
      mcqs = await generateMCQs(extractedText, topic, numQuestions);
    } else if (buffer) {
      console.log('Using Gemini Vision OCR for MCQ generation...');
      mcqs = await generateMCQsFromPdfBuffer(buffer, topic, numQuestions);
    }

    if (!mcqs || mcqs.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate MCQs from this PDF. Please try a different document.' },
        { status: 400 }
      );
    }

    // Create a new Test with the PDF and MCQs
    const test = await (prisma.test as any).create({
      data: {
        userId: session.user.id,
        title: fileName.replace(/\.pdf$/i, ''),
        description: `Generated from ${fileName} for topic: ${topic}`,
        duration: 30,
        pdfs: {
          create: [
            {
              name: fileName,
              url: fileUrl,
              fileSize: fileSize || buffer?.length || 0,
              pageCount: pageCount,
            },
          ],
        },
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
      },
      include: {
        questions: true,
        pdfs: true,
      },
    });

    return NextResponse.json({
      success: true,
      url: fileUrl,
      test,
      questions: test.questions,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}