import { getGenAIInstance, safeParseJSONArray, MCQQuestion, mcqSchema } from '@/app/lib/ai';
import { chunkDocumentSectionAware, calculateMultiPageCoverage, DocumentChunk, CoverageReport } from './chunker';
import { buildSecureDocumentEnvelope, SECURE_SYSTEM_INSTRUCTION } from './promptSecurity';
import { PipelineError } from './errors';
import { ERROR_CODES } from './types';

export interface MapReduceGenerationParams {
  documentText: string;
  topic?: string;
  numQuestions?: number;
  totalPages?: number;
  customApiKey?: string;
  customModel?: string;
}

export interface MapReduceGenerationResult {
  questions: MCQQuestion[];
  coverage: CoverageReport;
  totalChunks: number;
}

/**
 * Token Bucket Rate Limiter to smooth burst requests and respect Google Gemini TPM/RPM limits.
 */
export class TokenBucketRateLimiter {
  private capacity: number;
  private tokens: number;
  private refillRatePerSec: number;
  private lastRefill: number;

  constructor(capacity = 5, refillRatePerSec = 2) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRatePerSec);
    this.lastRefill = now;
  }

  async acquire(cost = 1): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      const waitMs = Math.ceil(((cost - this.tokens) / this.refillRatePerSec) * 1000);
      await new Promise((resolve) => setTimeout(resolve, Math.max(50, Math.min(waitMs, 1000))));
    }
  }
}

const globalRateLimiter = new TokenBucketRateLimiter(6, 2);

const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

/**
 * Executes a Gemini model call with exponential backoff, jitter, and automated model fallback.
 */
export async function executeWithBackoffAndFallback(
  prompt: string,
  options: {
    customApiKey?: string;
    customModel?: string;
    maxRetriesPerModel?: number;
    baseDelayMs?: number;
  } = {}
): Promise<string> {
  const { customApiKey, customModel, maxRetriesPerModel = 2, baseDelayMs = 800 } = options;
  const genAI = getGenAIInstance(customApiKey);

  const modelChain = customModel
    ? [customModel, ...FALLBACK_MODELS.filter((m) => m !== customModel)]
    : FALLBACK_MODELS;

  let lastError: any = null;

  for (const modelName of modelChain) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        await globalRateLimiter.acquire(1);

        const response = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: SECURE_SYSTEM_INSTRUCTION,
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        });

        const text = response?.text || '';
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const msg = (err?.message || '').toLowerCase();
        const status = err?.status || err?.statusCode || 0;

        const isRateLimitOrOverload =
          status === 429 || status === 503 || status === 500 ||
          msg.includes('429') || msg.includes('quota') || msg.includes('overloaded') || msg.includes('resource_exhausted');

        if (isRateLimitOrOverload && attempt < maxRetriesPerModel) {
          // Exponential backoff with jitter: baseDelay * 2^attempt + random(0, baseDelay)
          const jitter = Math.floor(Math.random() * baseDelayMs);
          const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
          console.warn(`[LLM_RETRY] Model ${modelName} hit error, retrying in ${delay}ms (attempt ${attempt + 1}):`, err?.message);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If permanent error or retries exhausted for this model, break to fallback model
        console.warn(`[LLM_FALLBACK] Model ${modelName} failed, advancing to next model in chain:`, err?.message);
        break;
      }
    }
  }

  throw new PipelineError(
    `All AI models failed to generate content: ${lastError?.message || 'Unknown LLM error'}`,
    ERROR_CODES.LLM_ERROR,
    500
  );
}

/**
 * Builds the map-phase question generation prompt for a specific document chunk.
 */
function buildChunkPrompt(chunk: DocumentChunk, topic: string, targetQuestions: number): string {
  const envelope = buildSecureDocumentEnvelope(chunk.text);

  return `
The primary subject topic is: **${topic}**.
You are analyzing: **${chunk.title}** (Covering Pages ${chunk.startPage} through ${chunk.endPage} of syllabus).
Your goal: Synthesize **${targetQuestions}** high-yield, pedagogically sound MCQs from this section.

----------------------
STUDY MATERIAL (EXCLUSIVELY TEST FACTUAL KNOWLEDGE FROM INSIDE THIS ENVELOPE)
----------------------
${envelope.wrappedContent}

----------------------
STRICT GENERATION MANDATES
----------------------
1. 100% of the facts tested MUST come directly from the study material above.
2. For every question, you MUST include:
   - "proofQuote": The EXACT verbatim sentence from the study material proving why the correct answer is correct.
   - "pageReference": "Page ${chunk.startPage}-${chunk.endPage}, Section ${chunk.index + 1}"
   - "citationType": "VERBATIM_PROOF"
3. ZERO META QUESTIONS: Never ask about syllabus format, exam marks, cutoffs, or document headers.
4. Provide 4 plausible options, with "correctAnswer" being the index (0, 1, 2, or 3).

Return ONLY a valid JSON array of question objects adhering to this schema:
[
  {
    "question": "Clear conceptual question statement",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Fact-based explanation proving correct answer.",
    "difficulty": "medium",
    "proofQuote": "Exact excerpt from text.",
    "pageReference": "Page ${chunk.startPage}",
    "citationType": "VERBATIM_PROOF"
  }
]
`.trim();
}

/**
 * Executes Section-Aware Map-Reduce MCQ Generation across large documents.
 * Completely replaces the blind 50,000-character truncation bug.
 */
export async function generateMCQsMapReduce(
  params: MapReduceGenerationParams
): Promise<MapReduceGenerationResult> {
  const {
    documentText,
    topic = 'General',
    numQuestions = 10,
    totalPages = 1,
    customApiKey,
    customModel,
  } = params;

  if (!documentText || documentText.trim().length === 0) {
    throw new PipelineError('No document text provided for MCQ synthesis.', ERROR_CODES.EMPTY);
  }

  // 1. Chunk document using section-aware segmentation
  const chunks = chunkDocumentSectionAware(documentText, { totalPages });

  // 2. Map Phase: Allocate question quota across chunks
  // E.g. If 15 questions requested from 5 chunks, allocate 3-4 questions per chunk
  const questionsPerChunk = Math.max(2, Math.ceil((numQuestions * 1.3) / chunks.length));

  // Run chunks with controlled concurrency (3 parallel workers)
  const candidateQuestions: (MCQQuestion & { chunkIndex: number })[] = [];
  const concurrency = 3;

  for (let i = 0; i < chunks.length; i += concurrency) {
    const chunkBatch = chunks.slice(i, i + concurrency);

    const batchPromises = chunkBatch.map(async (chunk) => {
      const prompt = buildChunkPrompt(chunk, topic, questionsPerChunk);
      try {
        const rawResponse = await executeWithBackoffAndFallback(prompt, {
          customApiKey,
          customModel,
        });

        const rawJson = safeParseJSONArray(rawResponse);
        const parsed = mcqSchema.safeParse(rawJson);

        if (parsed.success && parsed.data.length > 0) {
          return parsed.data.map((q) => ({
            ...q,
            chunkIndex: chunk.index,
            pageReference: q.pageReference || `Page ${chunk.startPage}-${chunk.endPage}`,
          }));
        }
      } catch (chunkErr) {
        console.warn(`[MAP_REDUCE] Chunk ${chunk.index} generation error:`, chunkErr);
      }
      return [];
    });

    const batchResults = await Promise.all(batchPromises);
    for (const res of batchResults) {
      candidateQuestions.push(...res);
    }
  }

  // Fallback: If map-reduce failed to harvest enough questions, run a single broad generation
  if (candidateQuestions.length === 0) {
    const fallbackChunk: DocumentChunk = {
      index: 0,
      totalChunks: 1,
      title: 'Full Text',
      startPage: 1,
      endPage: totalPages,
      text: documentText.slice(0, 40000),
      charCount: Math.min(documentText.length, 40000),
    };
    const fallbackPrompt = buildChunkPrompt(fallbackChunk, topic, numQuestions);
    const rawResponse = await executeWithBackoffAndFallback(fallbackPrompt, {
      customApiKey,
      customModel,
    });
    const parsed = mcqSchema.safeParse(safeParseJSONArray(rawResponse));
    if (parsed.success && parsed.data.length > 0) {
      candidateQuestions.push(...parsed.data.map((q) => ({ ...q, chunkIndex: 0 })));
    }
  }

  if (candidateQuestions.length === 0) {
    throw new PipelineError(
      'Could not synthesize valid MCQs from this document syllabus.',
      ERROR_CODES.LLM_ERROR
    );
  }

  // 3. Reduce Phase: De-duplicate, verify, balance, and prune to exact numQuestions requested
  const seenStems = new Set<string>();
  const curatedQuestions: (MCQQuestion & { chunkIndex: number })[] = [];

  for (const q of candidateQuestions) {
    const stem = q.question.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seenStems.has(stem)) {
      seenStems.add(stem);
      curatedQuestions.push(q);
    }
  }

  // Select evenly across chunks so the whole syllabus (front to back) is represented
  const selectedQuestions: (MCQQuestion & { chunkIndex: number })[] = [];
  const chunkBuckets = new Map<number, (MCQQuestion & { chunkIndex: number })[]>();

  for (const q of curatedQuestions) {
    if (!chunkBuckets.has(q.chunkIndex)) {
      chunkBuckets.set(q.chunkIndex, []);
    }
    chunkBuckets.get(q.chunkIndex)!.push(q);
  }

  // Round-robin selection across all chunks until target numQuestions reached
  let added = true;
  while (selectedQuestions.length < numQuestions && added) {
    added = false;
    for (const chunk of chunks) {
      const bucket = chunkBuckets.get(chunk.index);
      if (bucket && bucket.length > 0 && selectedQuestions.length < numQuestions) {
        selectedQuestions.push(bucket.shift()!);
        added = true;
      }
    }
  }

  // If still need more questions, top up from remaining curated questions
  if (selectedQuestions.length < numQuestions && curatedQuestions.length > selectedQuestions.length) {
    for (const q of curatedQuestions) {
      if (!selectedQuestions.includes(q)) {
        selectedQuestions.push(q);
        if (selectedQuestions.length >= numQuestions) break;
      }
    }
  }

  // 4. Calculate Multi-Page Coverage Metric
  const coverage = calculateMultiPageCoverage(chunks, totalPages, selectedQuestions);

  // Return clean MCQQuestion objects
  const finalQuestions: MCQQuestion[] = selectedQuestions.map((q) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || '',
    difficulty: q.difficulty || 'medium',
    proofQuote: q.proofQuote || '',
    pageReference: q.pageReference || '',
    citationType: q.citationType || 'VERBATIM_PROOF',
  }));

  return {
    questions: finalQuestions,
    coverage,
    totalChunks: chunks.length,
  };
}
