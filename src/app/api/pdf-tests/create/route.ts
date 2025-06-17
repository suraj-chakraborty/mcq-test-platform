import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import PDFTest from '@/app/models/PDFTest';
import { GoogleGenAI } from '@google/genai';
import formidable, { File } from 'formidable';
import { Readable } from 'stream';


// Helper: Convert Web Request to Node.js IncomingMessage
async function webRequestToIncomingMessage(request: Request): Promise<any> {
  const readable = Readable.fromWeb(request.body as any);
  const headers = Object.fromEntries(request.headers.entries());

  return Object.assign(readable, {
    headers,
    method: request.method,
    url: '',
  });
}

// Parse multipart form data using formidable
async function parseFormData(req: Request): Promise<{ fields: any; files: any }> {
  const incoming = await webRequestToIncomingMessage(req);
  const form = formidable({ multiples: true, keepExtensions: true });

  return new Promise((resolve, reject) => {
    form.parse(incoming, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fields, files } = await parseFormData(req);
    const title = fields.title?.[0] || '';
    const description = fields.description?.[0] || '';
    const contextPDFs = Array.isArray(files.contextPDF) ? files.contextPDF : [files.contextPDF];
    const pyqPDFs = Array.isArray(files.pyqPDF) ? files.pyqPDF : [files.pyqPDF];

    // console.log(title, description,contextPDFs,pyqPDFs)
    if (!title || !contextPDFs.length || !pyqPDFs.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const prompt = `
      Create a set of multiple-choice questions based on the following:

      Context PDFs: ${contextPDFs.map((f: File) => f.originalFilename).join(', ')}
      Previous Year PDFs: ${pyqPDFs.map((f: File) => f.originalFilename).join(', ')}

      Please create questions that:
      1. Are based on the content from the context PDFs
      2. Match the difficulty level of the previous year questions
      3. Include 4 options for each question
      4. Provide a clear explanation for the correct answer
      5. Indicate the difficulty level (easy, medium, hard)

      Format the response as a JSON array:
      {
        "questions": [
          {
            "question": "Question text",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": "Correct option",
            "explanation": "Explanation",
            "difficulty": "easy/medium/hard"
          }
        ]
      }
    `;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to get response from Gemini');
    }

    // console.log("result", result)
    const text = result.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    // console.log("cleanText", cleanText)
    const parsed = JSON.parse(cleanText);
    const questions = parsed.questions;
    console.log("questions",questions)
    const context = contextPDFs.map((f: any) => ({
      name: f.originalFilename.toString(),
      url: `/uploads/${f.newFilename}`  // Adjust this to match your file storage path
    }));
    
    const pyq = {
      name: pyqPDFs[0]?.originalFilename.toString(),
      url: `/uploads/${pyqPDFs[0]?.newFilename}`
    };
    const test = await PDFTest.create({
      userId: session.user.id,
      title,
      description,
      contextPDFs: context,
      pyqPDF: pyq,
      questions,
    });

    return NextResponse.json({ success: true, test });
  } catch (error) {
    console.error('Error creating PDF test:', error);
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
  }
}
