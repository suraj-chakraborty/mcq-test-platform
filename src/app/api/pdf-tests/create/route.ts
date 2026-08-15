import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { getGenAIInstance, safeParseJSONArray, isMetaOrAdministrativeQuestion } from '@/app/lib/ai';
import { generatedMCQSchema } from '@/app/lib/validations/test';
import { extractTextFromPdf } from '@/app/utils/pdfUtils';
import { saveFile } from '@/app/lib/fileStorage';
import { downloadCloudinaryPdf } from '@/app/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PdfInputItem {
  name: string;
  url?: string;
  publicId?: string;
  buffer?: Buffer;
  fileSize?: number;
  text?: string;
  pageCount?: number;
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
        publicId: f.publicId,
        fileSize: f.fileSize || 0,
        text: f.text,
        pageCount: f.pageCount,
      }));

      rawPyqPDFs = (body.pyqPDFs || []).map((f: any) => ({
        name: f.name || 'pyq.pdf',
        url: f.url,
        publicId: f.publicId,
        fileSize: f.fileSize || 0,
        text: f.text,
        pageCount: f.pageCount,
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
        let text = f.text || '';
        let pageCount = f.pageCount || 1;

        if (text && text.length >= 50) {
          // Client already extracted clean text
        } else {
          if (!buffer && fileUrl) {
            try {
              buffer = await downloadCloudinaryPdf(fileUrl, f.publicId);
            } catch (e) {
              console.warn(`Could not download buffer for ${f.name}:`, e);
            }
          }

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
        let text = f.text || '';
        let pageCount = f.pageCount || 1;

        if (text && text.length >= 50) {
          // Client already extracted clean text
        } else {
          if (!buffer && fileUrl) {
            try {
              buffer = await downloadCloudinaryPdf(fileUrl, f.publicId);
            } catch (e) {
              console.warn(`Could not download buffer for ${f.name}:`, e);
            }
          }

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

    const hasPYQs = pyqText.trim().length > 0 || processedPyqPDFs.length > 0;

    const prompt = `
You are a premier senior examination author, pedagogical architect, and fact-verification auditor.

The primary topic for these questions is: **${topic}**.
Your task is to generate **${numQuestions}** high-yield multiple-choice questions (MCQs).

----------------------
CRITICAL ROLE SEPARATION BETWEEN CONTEXT AND PYQ PDFs
----------------------
1. 📖 **CONTEXT PDFs = EXCLUSIVE KNOWLEDGE SOURCE**:
   - 100% of the facts, statistics, definitions, theories, rules, formulas, and academic knowledge tested in every question MUST BE SOURCED EXCLUSIVELY from the **Context PDFs**.
   - **NEVER** invent facts or test questions on concepts that only appear in the PYQ PDF if they are absent from the Context PDF.

2. 📐 **PYQ (PREVIOUS YEAR QUESTIONS) PDFs = STRUCTURAL & ARCHETYPAL BLUEPRINT**:
   - The PYQ documents serve as your structural style guide.
   - You MUST analyze the diverse question formats present in the PYQ reference and **REPLICATE THOSE EXACT QUESTION TYPES** for the concepts found in the Context PDF:
     * **Multi-Statement Evaluation**:
       "Consider the following statements regarding [Concept from Context PDF]:
       1. [Statement 1]
       2. [Statement 2]
       3. [Statement 3]
       
       Which of the statements given above is/are correct?
       A. 1 only
       B. 1 and 2 only
       C. 2 and 3 only
       D. 1, 2 and 3"
     * **Assertion-Reasoning (A/R)**:
       "Assertion (A): [Factual assertion from Context PDF]
       Reason (R): [Explanation/cause from Context PDF]"
       (Options: Standard Assertion-Reasoning choices)
     * **Match List-I with List-II (4x4 Matrix Matching)**:
       "Match List-I ([Category A]) with List-II ([Category B]):
       
       **List-I:**
       A. [Item 1]
       B. [Item 2]
       C. [Item 3]
       D. [Item 4]
       
       **List-II:**
       1. [Match 1]
       2. [Match 2]
       3. [Match 3]
       4. [Match 4]"
       (Options: A. (A)-1, (B)-2, (C)-3, (D)-4, etc.)
     * **Negative Logic / Fact Check**:
       "With reference to [Topic from Context PDF], which one of the following statements is INCORRECT / NOT correct?"
     * **Analytical Scenario / Case Application**:
       "Suppose [Scenario involving principles from Context PDF]... Which of the following outcomes will occur?"
     * **Direct Conceptual / Formula-based Single Correct**.

3. 🔀 **MANDATORY DIVERSITY DISTRIBUTION**:
   - When generating the ${numQuestions} questions, you MUST generate a balanced variety across the distinct question types identified above (e.g. mix Statement-based, Assertion-Reason, List Matching, Negative logic, and Scenario questions) so the test is engaging and accurately reflects the full breadth of the PYQ pattern!

----------------------
CRITICAL VERIFIABLE PROOF & CITATION RULES
----------------------
For every question, you MUST include:
1. "proofQuote": The EXACT verbatim sentence or excerpt from the Context PDF that proves why the correct answer is correct.
2. "pageReference": The specific page number or section header (e.g., "Page 12, Section 3.1").
3. "citationType": "VERBATIM_PROOF" if directly quoted, or "LOGICAL_DEDUCTION" if conceptually derived.

----------------------
STRICT PEDAGOGICAL CONTENT MANDATE & ANTI-PATTERNS
----------------------
1. 🚫 ZERO META / ADMINISTRATIVE QUESTIONS:
   - DO NOT create questions testing administrative metadata about the document, syllabus outline, or exam structure, such as:
     * Exam duration or total marks (e.g., "What is the total marks allocation or duration of the preliminary exam?").
     * Number of sections, negative marking rules, passing cutoffs, or eligibility age limits.
     * Application dates, notification numbers, document titles, or author/institution names.
     * "According to the summary/index/pattern of this PDF..."
   - ALWAYS test the actual SUBSTANTIVE ACADEMIC / DOMAIN KNOWLEDGE discussed inside the text!

2. 🚫 RELEVANCE & DISTRACTOR QUALITY:
   - Ensure all 4 options are plausible, relevant choices testing subject comprehension.
   - Avoid generic, trivial, or obviously ridiculous dummy options.

----------------------
SOURCE MATERIAL
----------------------
**Context PDFs Extracted Text (100% Knowledge Source):**
${contextText.slice(0, 50000)}

${hasPYQs ? `**PYQ Reference PDFs Extracted Text (Structural Question Blueprint):**\n${pyqText.slice(0, 50000)}` : ''}

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
    const modelsToTry = customModel
      ? [customModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro']
      : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
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

    const parsedQuestions = safeParseJSONArray(aiText);
    if (!parsedQuestions || parsedQuestions.length === 0) {
      return NextResponse.json({ error: 'Invalid JSON format received from AI' }, { status: 400 });
    }

    // Validate generated MCQs with Zod
    const validationResult = generatedMCQSchema.safeParse(parsedQuestions);
    if (!validationResult.success) {
      console.error('AI Output failed schema validation:', validationResult.error.format());
      return NextResponse.json({ error: 'AI produced invalid question structure' }, { status: 500 });
    }

    // Filter out any meta/administrative questions that leaked through
    let validQuestions = validationResult.data.filter((q) => !isMetaOrAdministrativeQuestion(q.question));
    if (validQuestions.length === 0) {
      validQuestions = validationResult.data;
    }

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
