import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';
import { generatedMCQSchema } from '@/app/lib/validations/test';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { saveFile } from '@/app/lib/fileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PdfInputItem {
  name: string;
  url?: string;
  buffer?: Buffer;
  fileSize?: number;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let description = '';
    let topic = 'General';
    let numQuestions = 10;
    let rawContextPDFs: PdfInputItem[] = [];
    let rawPyqPDFs: PdfInputItem[] = [];

    if (contentType.includes('application/json')) {
      // 1. JSON Payload from Direct Cloudinary Client Upload
      const body = await req.json();
      title = body.title || '';
      description = body.description || '';
      topic = body.domainTopic || 'General';
      numQuestions = parseInt(body.numQuestions || '10', 10);

      rawContextPDFs = (body.contextPDFs || []).map((f: any) => ({
        name: f.name || 'context.pdf',
        url: f.url,
        fileSize: f.fileSize || 0,
      }));

      rawPyqPDFs = (body.pyqPDFs || []).map((f: any) => ({
        name: f.name || 'pyq.pdf',
        url: f.url,
        fileSize: f.fileSize || 0,
      }));
    } else {
      // 2. FormData Fallback
      const formData = await req.formData();
      title = formData.get('title')?.toString() || '';
      description = formData.get('description')?.toString() || '';
      topic = formData.get('domainTopic')?.toString() || 'General';
      numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10', 10);

      const contextFiles = formData.getAll('contextPDF').filter((f) => f instanceof File) as File[];
      const pyqFiles = formData.getAll('pyqPDF').filter((f) => f instanceof File) as File[];

      for (const f of contextFiles) {
        const ab = await f.arrayBuffer();
        const buf = Buffer.from(ab);
        const url = await saveFile(f);
        rawContextPDFs.push({ name: f.name, url, buffer: buf, fileSize: f.size });
      }

      for (const f of pyqFiles) {
        const ab = await f.arrayBuffer();
        const buf = Buffer.from(ab);
        const url = await saveFile(f);
        rawPyqPDFs.push({ name: f.name, url, buffer: buf, fileSize: f.size });
      }
    }

    if (!title || rawContextPDFs.length === 0) {
      return NextResponse.json({ error: 'Missing required fields (title or context PDFs)' }, { status: 400 });
    }

    let contextText = '';
    let pyqText = '';
    const inlineDataParts: any[] = [];

    // Process each Context PDF
    const processedContextPDFs = await Promise.all(
      rawContextPDFs.map(async (f) => {
        let buffer = f.buffer;
        const fileUrl = f.url || '';

        if (!buffer && fileUrl) {
          const res = await fetch(fileUrl);
          if (res.ok) {
            buffer = Buffer.from(await res.arrayBuffer());
          }
        }

        let pageCount = 1;
        let text = '';

        if (buffer) {
          try {
            const result = await extractTextFromPdf(buffer);
            text = result.text;
            pageCount = result.pageCount;
            if (result.isScanned && buffer.length <= 15 * 1024 * 1024) {
              inlineDataParts.push({
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf',
                },
              });
            }
          } catch (e) {
            console.log(`Context PDF ${f.name} failed text extraction, using native vision.`);
            if (buffer.length <= 15 * 1024 * 1024) {
              inlineDataParts.push({
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf',
                },
              });
            }
          }
        }

        if (text && text.length >= 50) {
          contextText += `\n--- Context Document: ${f.name} ---\n${text}\n`;
        }

        return {
          name: f.name || 'document.pdf',
          url: fileUrl,
          fileSize: f.fileSize || buffer?.length || 0,
          pageCount,
        };
      })
    );

    // Process each PYQ PDF
    const processedPyqPDFs = await Promise.all(
      rawPyqPDFs.map(async (f) => {
        let buffer = f.buffer;
        const fileUrl = f.url || '';

        if (!buffer && fileUrl) {
          const res = await fetch(fileUrl);
          if (res.ok) {
            buffer = Buffer.from(await res.arrayBuffer());
          }
        }

        let pageCount = 1;
        let text = '';

        if (buffer) {
          try {
            const result = await extractTextFromPdf(buffer);
            text = result.text;
            pageCount = result.pageCount;
            if (result.isScanned && buffer.length <= 15 * 1024 * 1024) {
              inlineDataParts.push({
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf',
                },
              });
            }
          } catch (e) {
            console.log(`PYQ PDF ${f.name} failed text extraction, using native vision.`);
            if (buffer.length <= 15 * 1024 * 1024) {
              inlineDataParts.push({
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf',
                },
              });
            }
          }
        }

        if (text && text.length >= 50) {
          pyqText += `\n--- PYQ Document: ${f.name} ---\n${text}\n`;
        }

        return {
          name: f.name || 'document.pdf',
          url: fileUrl,
          fileSize: f.fileSize || buffer?.length || 0,
          pageCount,
        };
      })
    );

    const pdfsData = [...processedContextPDFs, ...processedPyqPDFs];

    const prompt = `
You are an expert question generator, exam author, and fact-verification auditor.

The primary topic for these questions is: **${topic}**.
Your task is to generate **${numQuestions}** high-yield multiple-choice questions (MCQs).

----------------------
CRITICAL VERIFIABLE PROOF & CITATION RULES
----------------------
For every question, you MUST include:
1. "proofQuote": The EXACT verbatim sentence or excerpt from the documents that proves why the correct answer is correct.
2. "pageReference": The specific page number or section (e.g., "Page 12, Section 3.1").
3. "citationType": "VERBATIM_PROOF" if directly quoted, or "LOGICAL_DEDUCTION" if conceptually derived.

----------------------
SOURCE & QUESTION GUIDELINES
----------------------
1. All questions must be strictly based on the provided Context PDFs (attached as text or via vision).
2. Question difficulty must match the style of the Previous Year PDFs (PYQ).
3. Generate a rich mixture of question types: Standard Single Correct, Passage-Based, Assertion-Reasoning, List Matching, Multiple Statements.
4. Format: Exactly 4 distinct options per question, exactly 1 correct answer index (0-3).

**Context PDFs Extracted Text:**
${contextText.slice(0, 50000)}

**PYQ PDFs Extracted Text:**
${pyqText.slice(0, 50000)}

Format the response EXACTLY as a JSON array of question objects (do not wrap in an outer object):
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Clear explanation referencing context.",
    "difficulty": "medium",
    "proofQuote": "Exact sentence quoted from the document proving the answer.",
    "pageReference": "Page X, Section Y",
    "citationType": "VERBATIM_PROOF"
  }
]
`;

    const customApiKey = req.headers.get('x-ai-key') || undefined;
    const customModel = req.headers.get('x-ai-model') || undefined;
    const genAI = getGenAIInstance(customApiKey);
    const modelsToTry = customModel ? [customModel, 'gemini-2.5-flash', 'gemini-1.5-flash'] : ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let aiText = '';

    for (const modelName of modelsToTry) {
      try {
        const aiResult = await genAI.models.generateContent({
          model: modelName,
          contents: [...inlineDataParts, prompt],
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (aiResult.text) {
          aiText = aiResult.text;
          break;
        }
      } catch (err) {
        console.warn(`Model ${modelName} failed in pdf-tests/create, trying fallback:`, err);
      }
    }

    if (!aiText) {
      throw new Error('Failed to get response from AI model');
    }

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(aiText.replace(/```json|```/g, '').trim());
    } catch (err) {
      console.error('Failed to parse JSON:', err);
      return NextResponse.json({ error: 'Invalid JSON format received from AI' }, { status: 400 });
    }

    // Validate generated MCQs with Zod
    const validationResult = generatedMCQSchema.safeParse(parsedQuestions);
    if (!validationResult.success) {
      console.error('AI Output failed schema validation:', validationResult.error.format());
      return NextResponse.json({ error: 'AI produced invalid question structure' }, { status: 500 });
    }

    const validQuestions = validationResult.data;

    // Create Test in Prisma with nested Questions and PDFs
    const test = await prisma.test.create({
      data: {
        userId: session.user.id,
        title,
        description,
        duration: 60,
        questions: {
          create: validQuestions.map((q) => ({
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
          create: pdfsData,
        },
      },
      include: {
        questions: true,
        pdfs: true,
      },
    });

    return NextResponse.json({ success: true, test });
  } catch (error) {
    console.error('Error creating PDF test:', error);
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
  }
}
