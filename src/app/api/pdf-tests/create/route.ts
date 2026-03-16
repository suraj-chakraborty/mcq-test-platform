import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { generatedMCQSchema } from '@/lib/validations/test';
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
    const topic = fields.domainTopic || 'General';
    const numQuestions = parseInt(fields.numQuestions || '10');
    
    const contextPDFs = Array.isArray(files.contextPDF) ? files.contextPDF : [files.contextPDF].filter(Boolean);
    const pyqPDFs = Array.isArray(files.pyqPDF) ? files.pyqPDF : [files.pyqPDF].filter(Boolean);

    if (!title || !contextPDFs.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

   const prompt = `
You are an expert question generator for educational purposes.

The primary topic for these questions is: **${topic}**.

Your task is to generate **${numQuestions}** multiple-choice questions (MCQs).

Please adhere to the following guidelines:
1.  **Content Source:** All questions must be *strictly and exclusively* based on the content provided within the "Context PDFs". Do not introduce any outside information or concepts.
2.  **Relevance:** All questions must be relevant to the specified topic: "${topic}".
3.  **Difficulty Level:** The difficulty level of the generated questions should match the examples implicitly found in the "Previous Year PDFs".
4.  **Options:** Each question must include exactly 4 distinct options.
5.  **Explanation:** Provide a clear, concise explanation for the correct answer, directly referencing the "Context PDFs" content where the information can be found.
6.  **Difficulty Rating:** Indicate the difficulty level for each question (easy, medium, or hard).

**Context PDFs:**
${contextPDFs.map((f: File) => f.originalFilename).join('\n')}

**Previous Year PDFs (for difficulty reference):**
${pyqPDFs.map((f: File) => f.originalFilename).join('\n')}

Format the response EXACTLY as a JSON array of question objects (do not wrap in an outer object):
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Explanation for the correct answer, referencing context.",
    "difficulty": "easy"
  }
]
`;

    const aiResult = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!aiResult.text) {
      throw new Error('Failed to get response from Gemini');
    }

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(aiResult.text);
    } catch (err) {
      console.error("Failed to parse JSON:", err);
      return NextResponse.json({ error: 'Invalid JSON format received from AI' }, { status: 400 });
    }

    // Validate generated MCQs with Zod
    const validationResult = generatedMCQSchema.safeParse(parsedQuestions);
    if (!validationResult.success) {
      console.error("AI Output failed schema validation:", validationResult.error.format());
      return NextResponse.json({ error: 'AI produced invalid question structure' }, { status: 500 });
    }

    const validQuestions = validationResult.data;

    // Collate PDF metadata
    const pdfsData = [
      ...contextPDFs.map((f: any) => ({ name: f.originalFilename, url: `/uploads/${f.newFilename}` })),
      ...pyqPDFs.map((f: any) => ({ name: f.originalFilename, url: `/uploads/${f.newFilename}` }))
    ];

    // Create Test in Prisma with nested Questions and PDFs
    const test = await prisma.test.create({
      data: {
        userId: session.user.id,
        title,
        description,
        duration: 60, // Default duration
        questions: {
          create: validQuestions.map(q => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            // mapping difficulty omitted for brevity, fallback logic works
          }))
        },
        pdfs: {
          create: pdfsData
        }
      },
      include: {
        questions: true,
        pdfs: true
      }
    });

    return NextResponse.json({ success: true, test });
  } catch (error) {
    console.error('Error creating PDF test:', error);
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
  }
}
