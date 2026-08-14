import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { splitTextIntoSections } from '@/app/utils/pdfUtils';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  proofQuote?: string;
  pageReference?: string;
  citationType?: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION';
}

export const mcqSchema = z.array(
  z.object({
    question: z.string().min(5),
    options: z.array(z.string().min(1)).length(4),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().optional().default(''),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium').optional(),
    proofQuote: z.string().optional().default(''),
    pageReference: z.string().optional().default(''),
    citationType: z.enum(['VERBATIM_PROOF', 'LOGICAL_DEDUCTION']).default('VERBATIM_PROOF').optional(),
  })
);

export const getGenAIInstance = () => {
  const keysString = process.env.GOOGLE_AI_API_KEYS;
  if (keysString) {
    const keys = keysString.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      return new GoogleGenAI({ apiKey: randomKey });
    }
  }
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
};

const PROMPT_TEMPLATE = (context: string, topic: string, numQuestions: number, isBufferMode: boolean) => `
You are a master pedagogical assessment architect and subject-matter expert for competitive examinations.

Your task is to generate **${numQuestions}** SMART, highly relevant, and pedagogically sound Multiple-Choice Questions (MCQs) strictly based on the provided document content.

----------------------
INPUT DETAILS
----------------------
Subject/Topic: ${topic}
Requested Question Count: ${numQuestions}

${isBufferMode ? 'Document: Attached PDF (Direct Visual, Structural, and Textual Analysis)' : `Document Text Content:\n"""\n${context}\n"""`}

----------------------
STEP 1: AUTOMATIC DOCUMENT ARCHETYPE DETECTION & QUESTION STRATEGY
----------------------
Analyze the document's content type and adapt the question style accordingly:

1. **VOCABULARY / ENGLISH LANGUAGE / GRAMMAR (e.g. Word lists, Idioms, Phrasal verbs, Grammar rules)**:
   - Generate:
     - Contextual Synonyms & Antonyms (e.g., "Which of the following is the most accurate SYNONYM for '**COMMEND**'?")
     - Sentence Completion / Fill in the blanks (e.g., "Select the word that best completes the sentence: 'The committee found the evidence ______ and dismissed the claim.'")
     - Precise Definition & Correct Usage in Sentences.
     - One-word substitutions or analogy pairs.
   - **DO NOT** create broken matching tables or awkward list codes for word lists. Keep each vocabulary question focused, clean, and testing one or two target words clearly.

2. **MATHEMATICS / QUANTITATIVE APTITUDE / PHYSICS / NUMERICALS**:
   - Generate applied word problems, formula calculations, logical step deductions, and numerical problem solving with clear mathematical parameters.

3. **SCIENCE / MEDICINE / ENGINEERING / BIOLOGY**:
   - Test biological functions, chemical processes, laws of physics, structural components, cause-and-effect mechanisms, and diagnostic/practical applications.

4. **HISTORY / POLITY / LAW / GENERAL STUDIES**:
   - Test conceptual significance, constitutional articles, chronology, policy impacts, and historical facts.

----------------------
STEP 2: STRICT QUESTION STRUCTURAL INTEGRITY
----------------------
- **Standard Single Correct**: Direct question prompt followed by 4 distinct plausible options.
- **Passage-Based**: Provide a concise passage in the 'question' field, followed by double newlines (\n\n) and the actual question.
- **Matching Questions (ONLY when source content explicitly contains natural 4x4 pairs)**:
  If used, you MUST format it cleanly with exact labels:
  "Match the items in List I with List II:

  **List I:**
  A. [Item 1]
  B. [Item 2]
  C. [Item 3]
  D. [Item 4]

  **List II:**
  1. [Pair 1]
  2. [Pair 2]
  3. [Pair 3]
  4. [Pair 4]"
  The options must be: "(A)-1, (B)-2, (C)-3, (D)-4", etc.
  **NEVER** generate incomplete lists, single-letter placeholders (like "1. t"), or malformed headers.

- **Assertion-Reasoning (ONLY for analytical subjects)**:
  "**Assertion (A):** [Statement A]
  **Reason (R):** [Statement R]"

----------------------
STEP 3: CITATION & VERIFIED PROOF
----------------------
For every question:
1. "proofQuote": The exact sentence or passage from the document that proves why the correct answer is true.
2. "pageReference": The specific page number or section header (e.g., "Page 4, Word List 2", "Page 15, Section 3").
3. "citationType": "VERBATIM_PROOF" if directly quoted, or "LOGICAL_DEDUCTION" if derived.

----------------------
RULES & CONSTRAINTS
----------------------
- Exactly 4 distinct options per question.
- Exactly 1 correct answer index (0, 1, 2, or 3).
- Difficulty: ~30% Easy, ~50% Medium, ~20% Hard.
- No duplicate questions. No trivia about coaching centers, phone numbers, or institute watermarks.

----------------------
OUTPUT FORMAT (STRICT JSON ARRAY ONLY)
----------------------
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Clear explanation of why this answer is correct.",
    "difficulty": "medium",
    "proofQuote": "Exact excerpt from the document verifying the answer.",
    "pageReference": "Page X, Section Y",
    "citationType": "VERBATIM_PROOF"
  }
]
`;

async function executeGeminiWithFallback(contents: any[]): Promise<string> {
  const genAI = getGenAIInstance();
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const result = await genAI.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (result.text) {
        return result.text;
      }
    } catch (err) {
      console.warn(`[executeGeminiWithFallback] Model ${model} failed, attempting next:`, err);
    }
  }

  throw new Error('All Gemini generation attempts failed');
}

export async function generateMCQsUniversal(params: {
  pdfBuffer?: Buffer;
  pdfText?: string;
  isScanned?: boolean;
  topic?: string;
  numQuestions?: number;
}): Promise<MCQQuestion[]> {
  const {
    pdfBuffer,
    pdfText = '',
    isScanned = false,
    topic = 'General',
    numQuestions = 10,
  } = params;

  // Mode 1: Scanned PDF or pure visual/image PDF -> Multimodal Vision Processing
  if (isScanned && pdfBuffer) {
    console.log('[generateMCQsUniversal] Using Multimodal Vision pipeline for scanned/visual PDF');
    const prompt = PROMPT_TEMPLATE('', topic, numQuestions, true);

    try {
      const text = await executeGeminiWithFallback([
        {
          inlineData: {
            data: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ]);

      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const validated = mcqSchema.safeParse(parsed);
      if (validated.success) {
        return sanitizeCitations(validated.data, '');
      }
    } catch (err) {
      console.error('[generateMCQsUniversal] Multimodal Vision generation failed:', err);
    }
  }

  // Mode 2: Large Document Sectional Splitting (> 12,000 chars) -> Balanced Chapter Coverage
  if (pdfText && pdfText.length > 12000) {
    console.log(`[generateMCQsUniversal] Large document detected (${pdfText.length} chars). Applying balanced sectional splitting.`);
    const sections = splitTextIntoSections(pdfText, 12000);
    const questionsPerSection = Math.max(1, Math.ceil(numQuestions / sections.length));
    const allQuestions: MCQQuestion[] = [];

    for (let i = 0; i < sections.length; i++) {
      if (allQuestions.length >= numQuestions) break;
      const targetCount = Math.min(questionsPerSection, numQuestions - allQuestions.length);
      const sectionPrompt = PROMPT_TEMPLATE(sections[i], `${topic} (Section ${i + 1}/${sections.length})`, targetCount, false);

      try {
        const text = await executeGeminiWithFallback([sectionPrompt]);
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        const validated = mcqSchema.safeParse(parsed);
        if (validated.success) {
          allQuestions.push(...sanitizeCitations(validated.data, sections[i]));
        }
      } catch (err) {
        console.warn(`[generateMCQsUniversal] Section ${i + 1} processing error:`, err);
      }
    }

    if (allQuestions.length > 0) {
      return allQuestions.slice(0, numQuestions);
    }
  }

  // Mode 3: Standard Text PDF or Fallback to Buffer
  console.log('[generateMCQsUniversal] Standard text generation mode');
  const context = pdfText || (pdfBuffer ? 'Use attached PDF document' : '');
  const prompt = PROMPT_TEMPLATE(context, topic, numQuestions, false);

  try {
    const contents: any[] = [];
    if (pdfBuffer && (!pdfText || pdfText.length < 50)) {
      contents.push({
        inlineData: {
          data: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      });
    }
    contents.push(prompt);

    const text = await executeGeminiWithFallback(contents);
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    const validated = mcqSchema.safeParse(parsed);
    if (validated.success) {
      return sanitizeCitations(validated.data, pdfText);
    }
  } catch (err) {
    console.error('[generateMCQsUniversal] Standard generation failed:', err);
  }

  return [];
}

// Backward-compatible wrappers
export async function generateMCQs(pdfText: string, topic: string, numQuestions: number): Promise<MCQQuestion[]> {
  return generateMCQsUniversal({ pdfText, topic, numQuestions });
}

export async function generateMCQsFromPdfBuffer(pdfBuffer: Buffer, topic: string, numQuestions: number): Promise<MCQQuestion[]> {
  return generateMCQsUniversal({ pdfBuffer, isScanned: true, topic, numQuestions });
}

function sanitizeCitations(questions: any[], sourceText: string): MCQQuestion[] {
  return questions
    .filter((q) => q.question && q.options && q.options.length === 4 && q.correctAnswer >= 0 && q.correctAnswer <= 3)
    .map((q) => {
      let citationType: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION' = 'VERBATIM_PROOF';

      if (q.proofQuote && sourceText) {
        const normalizedSource = sourceText.toLowerCase().replace(/\s+/g, ' ');
        const normalizedQuote = q.proofQuote.toLowerCase().replace(/\s+/g, ' ');
        if (!normalizedSource.includes(normalizedQuote.slice(0, 25))) {
          citationType = 'LOGICAL_DEDUCTION';
        }
      }

      return {
        question: q.question.trim(),
        options: q.options.map((opt: string) => String(opt).trim()),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ? q.explanation.trim() : '',
        difficulty: q.difficulty || 'medium',
        proofQuote: q.proofQuote ? q.proofQuote.trim() : '',
        pageReference: q.pageReference ? q.pageReference.trim() : 'Document Reference',
        citationType: q.citationType || citationType,
      };
    });
}
