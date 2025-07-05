
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateMCQs } from '@/app/lib/ai';
import connectDB from '@/app/lib/mongodb';
import Pdf from '@/app/models/Pdf';
import { saveFile } from '@/app/lib/fileStorage';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import pdfParse from 'pdf-parse/lib/pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { mkdir } from 'fs/promises';
import path from 'path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
}

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const maxDuration = 10; // Vercel hard limit on free plan

async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const data = await pdfParse(buffer);
  if (!data.text || data.text.length < 50) {
    throw new Error('PDF too short or invalid');
  }
  return { text: data.text, numpages: data.numpages ?? 0 };
}

async function safeGenerateMCQs(text: string,topic:string, numQuestions:number, timeoutMs = 8000): Promise<any[]> {
  console.log(text.slice(0, 100), topic, numQuestions);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await generateMCQs(text, topic, numQuestions);
    return result;
  } catch (err) {
    console.warn('MCQ generation failed or timed out:', err);
    return []; // fallback
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    console.log(request)
    console.log('Received upload request');

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
     const topic = formData.get('domainTopic')?.toString() || 'General';
    //  console.log(`Topic: ${topic}`);
    const numQuestions = parseInt(formData.get('numQuestions')?.toString() || "10");
    // console.log(`Number of questions requested: ${numQuestions}`);

    const uploadDir = path.join('/tmp', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const results = await Promise.allSettled(
      files.map(async (file) => {
        if (file.type !== 'application/pdf') {
          throw new Error(`File ${file.name} is not a PDF`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File ${file.name} exceeds max size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileUrl = await saveFile(file);
        const { text, numpages } = await extractTextFromPdf(buffer);
        const mcqs = await safeGenerateMCQs(text,topic, numQuestions);

        await connectDB();

        const pdf = await Pdf.create({
          title: file.name,
          content: text,
          url: fileUrl,
          userId: session.user.id,
          fileSize: file.size,
          pageCount: numpages,
          mcqs: mcqs,
        });

        return {
          pdf,
          mcqs,
        };
      })
    );

    const processedPdfs = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results.filter((r) => r.status === 'rejected');

    return NextResponse.json({
      success: true,
      pdfs: processedPdfs.map((p) => ({
        filename: p.pdf.title,
        size: p.pdf.fileSize,
        url: p.pdf.url,
      })),
      mcqs: processedPdfs.flatMap((p) => p.mcqs),
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
