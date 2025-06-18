export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const maxDuration = 300;

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  const extractedText = data.text;
  if (!extractedText || extractedText.length < 50) {
    throw new Error('PDF too short or invalid');
  }
  return extractedText;
}

export async function POST(request: Request) {
  try {
    console.log("Received upload request");
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const processedPdfs = await Promise.all(files.map(async (file) => {
      if (file.type !== 'application/pdf') {
        throw new Error(`File ${file.name} is not a PDF`);
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File ${file.name} exceeds max size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileUrl = await saveFile(file);
      const text = await extractTextFromPdf(buffer);
      const mcqs = await generateMCQs(text);

      await connectDB();
      const pdf = await Pdf.create({
        title: file.name,
        content: text,
        url: fileUrl,
        userId: session.user.id,
        fileSize: file.size,
        pageCount: (await pdfParse(buffer)).numpages,
        mcqs: mcqs,
      });

      return {
        pdf,
        mcqs
      };
    }));

    // Combine MCQs from all PDFs
    const combinedMcqs = processedPdfs.flatMap(p => p.mcqs);

    return NextResponse.json({
      success: true,
      pdfs: processedPdfs.map(p => ({
        filename: p.pdf.title,
        size: p.pdf.fileSize,
        url: p.pdf.url,
      })),
      mcqs: combinedMcqs,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
