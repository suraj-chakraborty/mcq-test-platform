export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Pdf from '@/app/models/Pdf';
import { GoogleGenAI } from '@google/genai';
import pdfParse from 'pdf-parse';
import { saveFile } from '@/app/lib/fileStorage';
import { mkdir } from 'fs/promises';
import path from 'path';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { generateMCQs } from '@/app/lib/ai';



const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    // console.log("Received upload request");
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    // console.log("formData",formData)
    const file = formData.get('file') as File;
    // console.log("file", file)

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

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

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

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      url: fileUrl,
      mcqs,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 