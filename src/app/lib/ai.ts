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
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string(),
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
You are an expert assessment designer, curriculum examiner, and fact-verification auditor.

Your task is to generate high-quality, authentic multiple-choice questions based STRICTLY on the attached document content.

----------------------
INPUT
----------------------
Topic: ${topic}
Number of Questions: ${numQuestions}

${isBufferMode ? 'Document: Attached PDF (Multimodal Vision & Text)' : `Document Text Content:\n"""\n${context}\n"""`}

----------------------
CRITICAL CITATION & PROOF INSTRUCTIONS (MUST FOLLOW)
----------------------
For EVERY question you generate, you MUST provide:
1. "proofQuote": The EXACT verbatim sentence or excerpt from the document that proves beyond doubt why the chosen option is correct.
2. "pageReference": The specific page number or section header where this proof is located (e.g., "Page 3", "Page 14, Section 2.1").
3. "citationType": 
   - Set to "VERBATIM_PROOF" if the exact quote is directly present in the text/images.
   - Set to "LOGICAL_DEDUCTION" if the answer is a mathematical derivation or conceptual inference.

----------------------
SOURCE & FILTERING RULES
----------------------
- Extract information directly from text, images, charts, diagrams, and formulas.
- DO NOT generate questions about coaching institutes, tutor names, phone numbers, or promotional material.
- Ignore headers, footers, watermarks, and administrative metadata.
- Focus strictly on core academic concepts, principles, data, and problem-solving.

----------------------
QUESTION PATTERNS (Mixture strongly encouraged)
----------------------
1. **Standard Single Correct**: Direct conceptual/factual question with 4 options.
2. **Passage/Scenario-Based**: Paragraph scenario in the question followed by a question.
3. **Assertion-Reasoning**: **Assertion (A):** and **Reason (R):** formatted on separate lines.
4. **Matching Type**: **List I** and **List II** with pairs to match.
5. **Multiple Statements**: **Statement I**, **Statement II** evaluated together.

----------------------
FORMAT & DIFFICULTY
----------------------
- Exactly 4 distinct options per question.
- Exactly 1 correct answer index (0, 1, 2, or 3).
- Difficulty distribution: ~30% Easy, ~50% Medium, ~20% Hard.
- Explanations: Clear, concise breakdown of why the answer is correct with proof reference.

----------------------
OUTPUT FORMAT (STRICT JSON ONLY)
----------------------
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctAnswer": 0,
    "explanation": "string",
    "difficulty": "medium",
    "proofQuote": "Exact sentence quoted from the document proving the answer.",
    "pageReference": "Page X, Section Y",
    "citationType": "VERBATIM_PROOF"
  }
]
`;

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

  const genAI = getGenAIInstance();

  // Mode 1: Scanned PDF or pure visual/image PDF -> Multimodal Vision Processing
  if (isScanned && pdfBuffer) {
    console.log('[generateMCQsUniversal] Using Multimodal Vision pipeline for scanned/visual PDF');
    const prompt = PROMPT_TEMPLATE('', topic, numQuestions, true);

    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          {
            inlineData: {
              data: pdfBuffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          },
          prompt,
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = result.text || '';
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
        const result = await genAI.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: sectionPrompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = result.text || '';
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

    const result = await genAI.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = result.text || '';
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
  return questions.map((q) => {
    let citationType: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION' = 'VERBATIM_PROOF';

    if (q.proofQuote && sourceText) {
      const normalizedSource = sourceText.toLowerCase().replace(/\s+/g, ' ');
      const normalizedQuote = q.proofQuote.toLowerCase().replace(/\s+/g, ' ');
      if (!normalizedSource.includes(normalizedQuote.slice(0, 30))) {
        citationType = 'LOGICAL_DEDUCTION';
      }
    }

    return {
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty || 'medium',
      proofQuote: q.proofQuote || '',
      pageReference: q.pageReference || 'Document Reference',
      citationType: q.citationType || citationType,
    };
  });
}
