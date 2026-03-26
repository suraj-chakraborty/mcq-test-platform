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
    const numQuestions = parseInt(formData.get('numQuestions')?.toString() || '10');

    // Extract files from form data
    const contextPDFs = formData.getAll('contextPDF').filter(f => f instanceof File) as File[];
    const pyqPDFs = formData.getAll('pyqPDF').filter(f => f instanceof File) as File[];

    if (!title || contextPDFs.length === 0) {
      return NextResponse.json({ error: 'Missing required fields (title or context PDFs)' }, { status: 400 });
    }

    let contextText = "";
    let pyqText = "";
    const inlineDataParts: any[] = [];

    // Extract metadata and text/buffer for each Context PDF
    const processedContextPDFs = await Promise.all(contextPDFs.map(async (f: any) => {
      const arrayBuffer = await (f as any).arrayBuffer?.() || Buffer.from("");
      const buffer = Buffer.from(arrayBuffer);
      let pageCount = 1;
      let text = "";
      
      try {
        const result = await extractTextFromPdf(buffer);
        text = result.text;
        pageCount = result.pageCount;
      } catch (e) {
        console.log(`Context PDF ${f.originalFilename} failed text extraction, using native vision.`);
        inlineDataParts.push({
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "application/pdf"
          }
        });
      }

      if (text && text.length >= 50) {
        contextText += `\n--- Context Document: ${f.name} ---\n${text}\n`;
      } else if (text) {
        // Text extracted but very short, send to vision as well just in case
        inlineDataParts.push({
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "application/pdf"
          }
        });
      }

      const fileUrl = await saveFile(f);

      return {
        name: f.name || 'document.pdf',
        url: fileUrl,
        fileSize: f.size,
        pageCount
      };
    }));

    // Extract metadata and text/buffer for each PYQ PDF
    const processedPyqPDFs = await Promise.all(pyqPDFs.map(async (f: any) => {
      const arrayBuffer = await (f as any).arrayBuffer?.() || Buffer.from("");
      const buffer = Buffer.from(arrayBuffer);
      let pageCount = 1;
      let text = "";
      
      try {
        const result = await extractTextFromPdf(buffer);
        text = result.text;
        pageCount = result.pageCount;
      } catch (e) {
        console.log(`PYQ PDF ${f.name} failed text extraction, using native vision.`);
        inlineDataParts.push({
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "application/pdf"
          }
        });
      }

      if (text && text.length >= 50) {
        pyqText += `\n--- PYQ Document: ${f.name} ---\n${text}\n`;
      } else if (text) {
        inlineDataParts.push({
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "application/pdf"
          }
        });
      }

      const fileUrl = await saveFile(f);

      return {
        name: f.name || 'document.pdf',
        url: fileUrl,
        fileSize: f.size,
        pageCount
      };
    }));

    const pdfsData = [...processedContextPDFs, ...processedPyqPDFs];

    const prompt = `
You are an expert question generator for educational purposes.

The primary topic for these questions is: **${topic}**.
Your task is to generate **${numQuestions}** multiple-choice questions (MCQs).

Please adhere to the following guidelines:

----------------------
SOURCE RULES (STRICT)
----------------------
1. All questions must be strictly and exclusively based on the content provided within the "Context PDFs" (attached as text below or as PDF documents via vision). Do not introduce outside information.
2. The difficulty level of the generated questions should match the examples implicitly found in the "Previous Year PDFs" (PYQ).

----------------------
DATA FILTERING RULES (CRITICAL)
----------------------
- DO NOT generate questions about coaching classes, institute names, tutor names, or promotional material present in the PDFs.
- DO NOT generate questions about phone numbers, email addresses, websites, or contact information.
- Ignore watermarks, headers, footers, page numbers, and irrelevant administrative details.
- Focus strictly on academic, conceptual, or topical knowledge related to the subject.

----------------------
QUESTION PATTERNS & FORMATTING (CRITICAL)
----------------------
Generate a diverse mixture of question patterns based on the given context.
Strongly enforce a mixture of the following formats:
1. **Standard Single Correct**: Direct question with 4 options.
2. **Passage/Scenario-Based**: Paragraph followed by a question. Use \n\n separator.
3. **Assertion-Reasoning**: Use **Assertion (A):** and **Reason (R):** on separate lines.

4. **Matching Type**: Present **List I:** and **List II:** to be matched. 
   - **List I:** must use labels A, B, C, D.
   - **List II:** must use labels 1, 2, 3, 4.
   - **Example Structure:**
     Match the indicators with their values:
     **List I:**
     A. Fiscal Deficit
     B. CPI Inflation
     **List II:**
     1. 4.5%
     2. 5.1%
5. **Multiple Statements**: Use **Statement I:**, **Statement II:**, etc.
   - Each statement clearly numbered.
   - Follow with a question like "Which of the above statements are correct?".

**FORMATTING RULES:**

- Use **double newlines (\n\n)** between a passage/scenario and the question.
- Use **bold markdown (**text**)** for headers like **List I:**, **List II:**, **Assertion (A):**, **Reason (R):**, and **Statement I:**.
- **CRITICAL:** Use escaped newlines (\n) in JSON to ensure each list item and statement is on its own line. DO NOT clump items into a single line.

----------------------
QUESTION DESIGN & FORMAT RULES
----------------------
- CRITICAL: REGARDLESS of the pattern used above, every single question MUST be formatted to have EXACTLY 4 distinct options, and EXACTLY ONE correct answer index (0-3).
- Do NOT generate actual multi-select or 'true/false' questions unless they are adapted to fit the standard 4-option single-select format as described above.
- Each question must test understanding, not just recall
- Avoid vague or ambiguous wording
- Ensure each question is clearly answerable

**Context PDFs Extracted Text:**
${contextText.slice(0, 50000) /* limit text to avoid overwhelming context */}

**PYQ PDFs Extracted Text:**
${pyqText.slice(0, 50000)}

Format the response EXACTLY as a JSON array of question objects (do not wrap in an outer object):
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Explanation for the correct answer, referencing context.",
    "difficulty": "easy" // or "medium", "hard"
  }
]
`;

    const genAI = getGenAIInstance();
    const aiResult = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...inlineDataParts,
        prompt
      ],
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
