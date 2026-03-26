export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import pdfParse from 'pdf-parse';
import { saveFile } from '@/app/lib/fileStorage';
import { mkdir } from 'fs/promises';
import path from 'path';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { generateMCQs, generateMCQsFromPdfBuffer } from '@/app/lib/ai';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const topic = formData.get('domainTopic')?.toString() || 'General';
    const numQuestions = parseInt(formData.get('numQuestions')?.toString() || "10");

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size must be under ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const uploadDir = path.join('/tmp', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileUrl = await saveFile(file);
    
    let mcqs: any[] = [];
    let pageCount = 1;
    let extractedText = "";

    try {
      const { text, pageCount: pc } = await extractTextFromPdf(buffer);
      extractedText = text;
      pageCount = pc;
    } catch (e) {
      console.log("PDF text extraction failed or insufficient text. Falling back to Gemini Vision OCR.", e);
      try {
         const data = await pdfParse(buffer);
         pageCount = data.numpages || 1;
      } catch (innerE) {
         console.warn("Could not determine page count, defaulting to 1.");
      }
    }

    if (extractedText && extractedText.length >= 50) {
      mcqs = await generateMCQs(extractedText, topic, numQuestions);
    } else {
      console.log("Using Gemini Vision OCR for MCQ generation...");
      mcqs = await generateMCQsFromPdfBuffer(buffer, topic, numQuestions);
    }

    if (!mcqs || mcqs.length === 0) {
      return NextResponse.json({ error: 'Failed to generate MCQs from this PDF. Please try a different document.' }, { status: 400 });
    }

    // Create a new Test with the PDF and MCQs
    const test = await (prisma.test as any).create({
      data: {
        userId: session.user.id,
        title: file.name,
        description: `Generated from ${file.name} for topic: ${topic}`,
        duration: 30, // Default duration
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
        questions: {
          create: mcqs.map((q: any) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          })),
        },
      },
      include: {
        pdfs: true,
        questions: true,
      },
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      url: fileUrl,
      testId: test.id,
      mcqs: test.questions,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}