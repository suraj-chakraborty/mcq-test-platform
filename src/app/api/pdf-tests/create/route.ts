import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance } from '@/app/lib/ai';
import { generatedMCQSchema } from '@/app/lib/validations/test';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { saveFile } from '@/app/lib/fileStorage';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const title = formData.get('title')?.toString() || '';
    const description = formData.get('description')?.toString() || '';
    const topic = formData.get('domainTopic')?.toString() || 'General';
    const numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10', 10);

    // Extract files from form data
    const contextPDFs = formData.getAll('contextPDF').filter((f) => f instanceof File) as File[];
    const pyqPDFs = formData.getAll('pyqPDF').filter((f) => f instanceof File) as File[];

    if (!title || contextPDFs.length === 0) {
      return NextResponse.json({ error: 'Missing required fields (title or context PDFs)' }, { status: 400 });
    }

    let contextText = '';
    let pyqText = '';
    const inlineDataParts: any[] = [];

    // Extract metadata and text/buffer for each Context PDF
    const processedContextPDFs = await Promise.all(
      contextPDFs.map(async (f: File) => {
        const arrayBuffer = (await f.arrayBuffer?.()) || Buffer.from('');
        const buffer = Buffer.from(arrayBuffer);
        let pageCount = 1;
        let text = '';

        try {
          const result = await extractTextFromPdf(buffer);
          text = result.text;
          pageCount = result.pageCount;
          if (result.isScanned) {
            inlineDataParts.push({
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: 'application/pdf',
              },
            });
          }
        } catch (e) {
          console.log(`Context PDF ${f.name} failed text extraction, using native vision.`);
          inlineDataParts.push({
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          });
        }

        if (text && text.length >= 50) {
          contextText += `\n--- Context Document: ${f.name} ---\n${text}\n`;
        }

        const fileUrl = await saveFile(f);

        return {
          name: f.name || 'document.pdf',
          url: fileUrl,
          fileSize: f.size,
          pageCount,
        };
      })
    );

    // Extract metadata and text/buffer for each PYQ PDF
    const processedPyqPDFs = await Promise.all(
      pyqPDFs.map(async (f: File) => {
        const arrayBuffer = (await f.arrayBuffer?.()) || Buffer.from('');
        const buffer = Buffer.from(arrayBuffer);
        let pageCount = 1;
        let text = '';

        try {
          const result = await extractTextFromPdf(buffer);
          text = result.text;
          pageCount = result.pageCount;
          if (result.isScanned) {
            inlineDataParts.push({
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: 'application/pdf',
              },
            });
          }
        } catch (e) {
          console.log(`PYQ PDF ${f.name} failed text extraction, using native vision.`);
          inlineDataParts.push({
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          });
        }

        if (text && text.length >= 50) {
          pyqText += `\n--- PYQ Document: ${f.name} ---\n${text}\n`;
        }

        const fileUrl = await saveFile(f);

        return {
          name: f.name || 'document.pdf',
          url: fileUrl,
          fileSize: f.size,
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
