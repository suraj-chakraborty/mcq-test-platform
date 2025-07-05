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
    console.log(fields)
    const title = fields.title?.[0] || '';
    const description = fields.description?.[0] || '';
    const topic = fields.domainTopic || 'General';
    console.log("topic", topic)
    const numQuestions = parseInt(fields.numQuestions || '10');
    console.log("numQuestions", numQuestions)
    const contextPDFs = Array.isArray(files.contextPDF) ? files.contextPDF : [files.contextPDF];
    const pyqPDFs = Array.isArray(files.pyqPDF) ? files.pyqPDF : [files.pyqPDF];

    // console.log(title, description,contextPDFs,pyqPDFs)
    if (!title || !contextPDFs.length || !pyqPDFs.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

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

Format the response as a JSON array under a "questions" key:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Correct option",
      "explanation": "Explanation for the correct answer, referencing context.",
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
    let parsed
    // console.log("result", result)
    const text = result.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    try {
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("JSON not found in AI response.");
      }

      const jsonString = cleanText.substring(jsonStart, jsonEnd + 1);
      parsed = JSON.parse(jsonString);

      console.log("Parsed JSON:", parsed);
    } catch (err) {
      console.error("Failed to parse JSON:", err);
      return NextResponse.json({ error: 'Invalid JSON format received from AI' }, { status: 400 });
    }
    const questions = parsed.questions;
    // console.log("questions",questions)
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
