import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { splitTextIntoSections } from '@/app/utils/pdfUtils';

export interface CustomAIConfig {
  provider?: 'default' | 'gemini' | 'openai' | 'anthropic' | 'groq';
  apiKey?: string;
  model?: string;
}

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

export const getGenAIInstance = (customKey?: string) => {
  if (customKey) {
    return new GoogleGenAI({ apiKey: customKey });
  }

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

export const DEFAULT_GEMINI_MODELS: string[] = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
];

export const getGeminiModelsToTry = (customModel?: string): string[] => {
  if (customModel) {
    return [customModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== customModel)];
  }
  return [...DEFAULT_GEMINI_MODELS];
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
STEP 2: STRICT QUESTION STRUCTURAL INTEGRITY & DIVERSITY
----------------------
- **Multi-Statement Evaluation**:
  "Consider the following statements regarding [Concept]:
  1. [Statement 1]
  2. [Statement 2]
  3. [Statement 3]

  Which of the statements given above is/are correct?
  A. 1 only
  B. 1 and 2 only
  C. 2 and 3 only
  D. 1, 2 and 3"

- **Assertion-Reasoning (A/R)**:
  "**Assertion (A):** [Statement A]
  **Reason (R):** [Statement R]"
  Options: Standard Assertion-Reasoning options.

- **Match List-I with List-II (4x4 pairs)**:
  "Match List-I ([Category A]) with List-II ([Category B]):

  **List-I:**
  A. [Item 1]
  B. [Item 2]
  C. [Item 3]
  D. [Item 4]

  **List-II:**
  1. [Pair 1]
  2. [Pair 2]
  3. [Pair 3]
  4. [Pair 4]"
  Options: "(A)-1, (B)-2, (C)-3, (D)-4", etc.

- **Negative Logic / Fact-Check**:
  "Which one of the following statements regarding [Topic] is INCORRECT / NOT correct?"

- **Passage/Scenario-Based**: Provide a concise passage or scenario in the 'question' field, followed by double newlines (\\n\\n) and the target question.

- **Standard Single Correct**: Direct question prompt followed by 4 distinct plausible options.

----------------------
----------------------
STEP 3: STRICT PEDAGOGICAL CONTENT MANDATE & ANTI-PATTERNS
----------------------
1. 🚫 ZERO META / ADMINISTRATIVE QUESTIONS:
   - DO NOT create questions testing meta-information about the document, syllabus outline, or exam structure, such as:
     * Exam duration or total marks (e.g., "What is the total marks allocation or duration of the preliminary exam?").
     * Number of sections, negative marking rules, passing cutoffs, or eligibility age limits.
     * Application dates, notification numbers, document titles, or author/institution names.
     * "According to the summary/index/pattern of this PDF..."
   - ALWAYS test the actual SUBSTANTIVE ACADEMIC / DOMAIN KNOWLEDGE (e.g., Economic concepts, Monetary policy tools, Banking regulations, Financial ratios, Grammar/Vocabulary, Quantitative calculations, Scientific principles, Case studies, or Historical events) discussed inside the text!

2. 🚫 RELEVANCE & DISTRACTOR QUALITY:
   - Ensure all 4 options are plausible, relevant choices testing subject comprehension.
   - Avoid generic, trivial, or obviously ridiculous dummy options.

----------------------
STEP 4: CITATION & VERIFIABILITY PROOF MANDATE
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

async function executeAIWithFallback(
  promptText: string,
  bufferContents?: any[],
  customConfig?: CustomAIConfig
): Promise<string> {
  const provider = customConfig?.provider || 'default';
  const apiKey = customConfig?.apiKey;
  const customModel = customConfig?.model;

  // Custom Provider 1: OpenAI
  if (provider === 'openai' && apiKey) {
    const model = customModel || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI request failed: status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    // Ensure array format if wrapped in an object like { questions: [...] }
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
      if (parsed.questions && Array.isArray(parsed.questions)) return JSON.stringify(parsed.questions);
    } catch (e) { }
    return content;
  }

  // Custom Provider 2: Groq Cloud
  if (provider === 'groq' && apiKey) {
    const model = customModel || 'llama-3.3-70b-versatile';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq request failed: status ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
      if (parsed.questions && Array.isArray(parsed.questions)) return JSON.stringify(parsed.questions);
    } catch (e) { }
    return content;
  }

  // Custom Provider 3: Anthropic
  if (provider === 'anthropic' && apiKey) {
    const model = customModel || 'claude-3-5-haiku-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: `${promptText}\n\nIMPORTANT: Respond ONLY with a valid raw JSON array of questions.` }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic request failed: status ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '[]';
  }

  // Google Gemini (Either Custom Key or Default Multi-Key Fallback)
  const genAI = getGenAIInstance(provider === 'gemini' ? apiKey : undefined);
  const models = getGeminiModelsToTry(customModel);
  const contents = bufferContents || [promptText];

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
      console.warn(`[executeAIWithFallback] Gemini model ${model} failed, attempting next:`, err);
    }
  }

  throw new Error('All AI generation attempts failed');
}

export function safeParseJSONArray(rawText: string): any[] {
  if (!rawText) return [];

  const cleaned = rawText.replace(/```json|```/g, '').trim();

  // Attempt 1: Direct JSON.parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    if (parsed.mcqs && Array.isArray(parsed.mcqs)) return parsed.mcqs;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
  } catch (e) {
    // Continue to repair
  }

  // Attempt 2: Clean trailing commas & extract array block
  try {
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      const sanitized = arrayMatch[0]
        .replace(/,\s*([\]\}])/g, '$1')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
      const parsed = JSON.parse(sanitized);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // Continue to salvage individual question objects
  }

  // Attempt 3: Salvage individual question objects using regex matcher
  try {
    const objectRegex = /\{\s*"question"\s*:\s*"[\s\S]*?"(?:,|\s*\}).*?\}/g;
    const matches = cleaned.match(objectRegex) || [];
    const salvaged: any[] = [];
    for (const objStr of matches) {
      try {
        const fixed = objStr.replace(/,\s*([\]\}])/g, '$1');
        const obj = JSON.parse(fixed);
        if (obj && obj.question && Array.isArray(obj.options)) {
          salvaged.push(obj);
        }
      } catch {
        // Skip malformed snippet
      }
    }
    if (salvaged.length > 0) return salvaged;
  } catch (e) {
    // Return empty
  }

  return [];
}

export async function generateMCQsUniversal(params: {
  pdfBuffer?: Buffer;
  pdfText?: string;
  isScanned?: boolean;
  topic?: string;
  numQuestions?: number;
  customConfig?: CustomAIConfig;
}): Promise<MCQQuestion[]> {
  const {
    pdfBuffer,
    pdfText = '',
    isScanned = false,
    topic = 'General',
    numQuestions = 10,
    customConfig,
  } = params;

  // Mode 1: Scanned PDF or pure visual/image PDF -> Multimodal Vision Processing
  if (isScanned && pdfBuffer) {
    console.log('[generateMCQsUniversal] Using Multimodal Vision pipeline for scanned/visual PDF');
    const prompt = PROMPT_TEMPLATE('', topic, numQuestions, true);

    try {
      const text = await executeAIWithFallback(
        prompt,
        [
          {
            inlineData: {
              data: pdfBuffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          },
          prompt,
        ],
        customConfig
      );

      const rawArray = safeParseJSONArray(text);
      const validated = mcqSchema.safeParse(rawArray);
      if (validated.success && validated.data.length > 0) {
        return sanitizeCitations(validated.data, '');
      }
    } catch (err) {
      console.error('[generateMCQsUniversal] Multimodal Vision generation failed:', err);
    }
  }

  // Mode 2: Massive Document (> 35,000 chars) -> Balanced Parallel Sectional Coverage
  if (pdfText && pdfText.length > 35000) {
    console.log(`[generateMCQsUniversal] Massive document detected (${pdfText.length} chars). Applying parallel sectional generation.`);
    const sections = splitTextIntoSections(pdfText, 35000);
    const questionsPerSection = Math.max(1, Math.ceil(numQuestions / sections.length));

    const sectionPromises = sections.map(async (section, i) => {
      const sectionPrompt = PROMPT_TEMPLATE(section, `${topic} (Section ${i + 1}/${sections.length})`, questionsPerSection, false);
      try {
        const text = await executeAIWithFallback(sectionPrompt, undefined, customConfig);
        const rawArray = safeParseJSONArray(text);
        const validated = mcqSchema.safeParse(rawArray);
        if (validated.success && validated.data.length > 0) {
          return sanitizeCitations(validated.data, section);
        }
      } catch (err) {
        console.warn(`[generateMCQsUniversal] Section ${i + 1} processing error:`, err);
      }
      return [];
    });

    const sectionResults = await Promise.allSettled(sectionPromises);
    const allQuestions: MCQQuestion[] = [];
    for (const res of sectionResults) {
      if (res.status === 'fulfilled' && res.value.length > 0) {
        allQuestions.push(...res.value);
      }
    }

    if (allQuestions.length > 0) {
      return allQuestions.slice(0, numQuestions);
    }
  }

  // Mode 3: Standard Text PDF (under 35,000 chars) or Fallback to Buffer
  console.log('[generateMCQsUniversal] Standard text generation mode');
  const context = pdfText || (pdfBuffer ? 'Use attached PDF document' : '');
  const prompt = PROMPT_TEMPLATE(context, topic, numQuestions, false);

  try {
    let bufferContents: any[] | undefined = undefined;
    if (pdfBuffer && (!pdfText || pdfText.length < 50)) {
      bufferContents = [
        {
          inlineData: {
            data: pdfBuffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ];
    }

    const text = await executeAIWithFallback(prompt, bufferContents, customConfig);
    const rawArray = safeParseJSONArray(text);
    const validated = mcqSchema.safeParse(rawArray);
    if (validated.success && validated.data.length > 0) {
      return sanitizeCitations(validated.data, pdfText);
    }
  } catch (err) {
    console.error('[generateMCQsUniversal] Standard generation failed:', err);
  }

  return [];
}

// Specialized prompt for Direct Knowledge Tests (General Knowledge & Current Affairs)
const KNOWLEDGE_PROMPT_TEMPLATE = (topic: string, numQuestions: number) => {
  const isCurrentAffairs = topic.toLowerCase().includes('current affair') || topic.toLowerCase().includes('current event');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
  const currentMonthYear = `${currentMonthName} ${currentYear}`;

  if (isCurrentAffairs) {
    return `
You are a premier senior examiner and question author for competitive examinations (such as UPSC, SSC, Banking, State PSC, and Global Knowledge Olympiads).

============================================================
CRITICAL TEMPORAL MANDATE:
- CURRENT DATE: **${currentMonthYear}** (Year: **${currentYear}**)
- QUESTIONS MUST BE AUTHENTIC, HIGH-YIELD CURRENT AFFAIRS FROM THE RECENT EXAMINATION CYCLE (${currentYear - 1}–${currentYear}).
- Focus on real-world events, landmark global summits, space/defense missions, economic corridors, major awards, sports championships, and national schemes.
============================================================

Your task is to generate **${numQuestions}** authentic, high-yield, factually accurate Multiple-Choice Questions (MCQs) on **RECENT CURRENT AFFAIRS OF ${currentYear}**.

----------------------
CURRENT AFFAIRS DOMAIN COVERAGE (Distribute questions across these areas):
----------------------
1. **National & Global Summits / Geopolitics (${currentYear - 1}–${currentYear})**: G20, BRICS expansion, SCO, UN General Assembly, COP climate summits, bilateral accords, current international treaties.
2. **Science, Space & Emerging Technology**: Active space missions (ISRO Aditya-L1, Gaganyaan, Chandrayaan-3 findings, NASA Artemis & Europa Clipper), latest AI models & breakthroughs, defense & missile tests, renewable energy innovations.
3. **Economy, Banking & Trade**: GDP rankings, central bank/RBI monetary policy & repo rates, budget allocations, major economic corridors (such as IMEC) and global trade pacts.
4. **Awards, Honors & Milestones**: Nobel Prizes, civilian honors, prestigious recognitions.
5. **Sports Championships**: Summer Olympic Games, ICC World Cup championships, Grand Slam tennis, FIDE Chess Olympiad.
6. **Environment, Climate & Ecology**: Major global climate milestones, new wildlife reserves, international conservation agreements.
7. **Government Schemes & National Policy**: Landmark welfare schemes, digital public infrastructure (UPI), health & education initiatives.

----------------------
STRICT GENERATION RULES:
----------------------
- **REAL FACTS ONLY**: Every question MUST test real-world events, true facts, actual personalities, correct organizations, and official dates.
- **NEVER generate meta-questions about "documents", "prompts", or "texts"**.
- **Realistic Distractors**: The 3 wrong choices must be plausible, realistic alternatives (e.g. real competing countries, genuine personalities, or adjacent dates/names).
- **Difficulty Balance**: 30% Easy, 50% Medium, 20% Hard.
- **Pedagogical Explanation**: 2-3 sentences providing the accurate context and why the correct option is right.
- **Topic Tag & Fact Verification**: Set 'pageReference' to the specific domain (e.g. "Science & Space Tech", "Economy & Trade", "Global Summits") and 'proofQuote' to a concise factual summary statement.

----------------------
MANDATORY JSON OUTPUT FORMAT
----------------------
Output ONLY a raw JSON array matching this exact schema:
[
  {
    "question": "Which country assumed the G20 presidency focusing on global governance reform and climate finance in 2024–2025?",
    "options": ["India", "Brazil", "South Africa", "United States"],
    "correctAnswer": 1,
    "explanation": "Brazil assumed the G20 presidency, hosting major multilateral climate and economic dialogues throughout the cycle.",
    "difficulty": "medium",
    "pageReference": "Global Summits & Geopolitics",
    "proofQuote": "Brazil assumed the G20 presidency leading international dialogues.",
    "citationType": "VERBATIM_PROOF"
  }
]
`;
  }

  // General Knowledge Prompt
  return `
You are a premier senior examiner and question author for competitive examinations (such as UPSC, SSC CGL, State PSC, GRE, and Global Knowledge Olympiads).

CURRENT TEMPORAL CONTEXT: **${currentMonthYear}** (Year: **${currentYear}**).
Your task is to generate **${numQuestions}** diverse, intellectually stimulating, and factually accurate Multiple-Choice Questions (MCQs) testing core **GENERAL KNOWLEDGE (GK)**.

----------------------
GK DOMAIN COVERAGE (Ensure rich diversity across multiple subjects):
----------------------
1. **History**: Ancient, Medieval, and Modern World & National History, freedom movements, landmark treaties, historic civilizations.
2. **Geography**: Physical geography (rivers, straits, mountain ranges, ocean currents), climate zones, world capitals, UNESCO World Heritage Sites.
3. **General Science**:
   - Physics: Fundamental laws, optics, astronomy, electromagnetism, space science.
   - Chemistry: Elements, periodic table trends, common compounds, chemical reactions.
   - Biology: Human physiology, genetics, ecology, botany, pathogens and health.
4. **Polity & Governance**: Constitutional frameworks, fundamental rights, international bodies (UN, ICJ, WHO, WTO).
5. **Economy & Financial Basics**: Economic terms, banking concepts, trade organizations.
6. **Culture & Inventions**: Classical arts, landmark discoveries, famous inventions, world monuments.

----------------------
STRICT GENERATION RULES:
----------------------
- **REAL KNOWLEDGE ONLY**: Every question MUST test real historical events, scientific laws, geographical facts, or constitutional rules.
- **NEVER generate meta-questions about "documents", "prompts", or "texts"**.
- **Realistic Distractors**: The 3 wrong choices must be plausible, well-known alternatives in the same domain.
- **Difficulty Balance**: 30% Easy, 50% Medium, 20% Hard.
- **Pedagogical Explanation**: 2-3 sentences explaining the factual or scientific reason behind the correct answer.
- **Topic Tag**: Set 'pageReference' to the specific subject domain (e.g. "Physical Geography", "Modern History", "Biology & Health", "Polity & Constitution").

----------------------
MANDATORY JSON OUTPUT FORMAT
----------------------
Output ONLY a raw JSON array matching this exact schema:
[
  {
    "question": "Which layer of the Earth's atmosphere contains the ozone layer responsible for absorbing harmful ultraviolet radiation?",
    "options": ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"],
    "correctAnswer": 1,
    "explanation": "The stratosphere contains the ozone layer (ozonosphere) at an altitude of approximately 15 to 35 km, which absorbs over 97% of the sun's medium-frequency ultraviolet light.",
    "difficulty": "medium",
    "pageReference": "Physical Geography & Science",
    "proofQuote": "The ozone layer is located primarily in the lower portion of the stratosphere.",
    "citationType": "VERBATIM_PROOF"
  }
]
`;
};

// Fallback bank for General Knowledge
const FALLBACK_GK_BANK: MCQQuestion[] = [
  {
    question: "Which layer of the Earth's atmosphere contains the ozone layer responsible for absorbing ultraviolet radiation?",
    options: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"],
    correctAnswer: 1,
    explanation: "The stratosphere contains the ozone layer at an altitude of roughly 15-35 km, which shields the Earth from harmful UV radiation.",
    difficulty: "medium",
    pageReference: "Physical Geography",
    proofQuote: "The ozone layer is located within the stratosphere.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which strait connects the Pacific Ocean with the Indian Ocean through Southeast Asia?",
    options: ["Strait of Gibraltar", "Strait of Hormuz", "Strait of Malacca", "Bering Strait"],
    correctAnswer: 2,
    explanation: "The Strait of Malacca runs between the Malay Peninsula and the Indonesian island of Sumatra, connecting the Indian Ocean and the Pacific Ocean.",
    difficulty: "medium",
    pageReference: "World Geography",
    proofQuote: "The Strait of Malacca is the main shipping channel between the Indian and Pacific Oceans.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the powerhouse of the eukaryotic cell where ATP synthesis occurs?",
    options: ["Ribosome", "Mitochondria", "Endoplasmic Reticulum", "Golgi Apparatus"],
    correctAnswer: 1,
    explanation: "Mitochondria are double-membrane-bound organelles responsible for generating most of the chemical energy needed to power biochemical reactions via ATP.",
    difficulty: "easy",
    pageReference: "Biology & Life Sciences",
    proofQuote: "Mitochondria generate cellular energy in the form of ATP.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "In which year was the Universal Declaration of Human Rights (UDHR) adopted by the United Nations General Assembly?",
    options: ["1945", "1948", "1950", "1952"],
    correctAnswer: 1,
    explanation: "The Universal Declaration of Human Rights was adopted by the UN General Assembly in Paris on December 10, 1948.",
    difficulty: "medium",
    pageReference: "World History & Polity",
    proofQuote: "The UDHR was proclaimed by the United Nations General Assembly in Paris on 10 December 1948.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which gas is primarily responsible for the greenhouse effect and ocean acidification when absorbed by seawater?",
    options: ["Nitrogen", "Methane", "Carbon Dioxide", "Argon"],
    correctAnswer: 2,
    explanation: "Carbon dioxide (CO2) is a primary greenhouse gas that dissolves in ocean water to form carbonic acid, causing ocean acidification.",
    difficulty: "easy",
    pageReference: "Environmental Chemistry",
    proofQuote: "Carbon dioxide absorption by seawater lowers ocean pH, resulting in acidification.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Who developed the General Theory of Relativity published in 1915?",
    options: ["Isaac Newton", "Niels Bohr", "Albert Einstein", "Max Planck"],
    correctAnswer: 2,
    explanation: "Albert Einstein published the General Theory of Relativity in 1915, describing gravity as the geometric curvature of spacetime.",
    difficulty: "easy",
    pageReference: "Physics & Astronomy",
    proofQuote: "Albert Einstein presented his general theory of relativity in late 1915.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the longest river in South America by discharge volume and length?",
    options: ["Parana River", "Orinoco River", "Amazon River", "Magdalena River"],
    correctAnswer: 2,
    explanation: "The Amazon River is the largest river by discharge volume of water in the world and the longest river in South America.",
    difficulty: "easy",
    pageReference: "Physical Geography",
    proofQuote: "The Amazon River in South America is the largest river by water discharge in the world.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which organ in the human body produces the hormone Insulin?",
    options: ["Liver", "Pancreas", "Thyroid", "Adrenal Gland"],
    correctAnswer: 1,
    explanation: "Insulin is produced by the beta cells of the Islets of Langerhans in the pancreas to regulate blood glucose levels.",
    difficulty: "easy",
    pageReference: "Human Physiology",
    proofQuote: "The pancreas produces insulin to regulate blood glucose levels.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which fundamental right is guaranteed under Article 21 of the Indian Constitution?",
    options: ["Right to Equality", "Right to Freedom of Speech", "Right to Life and Personal Liberty", "Right to Constitutional Remedies"],
    correctAnswer: 2,
    explanation: "Article 21 of the Constitution of India provides that 'No person shall be deprived of his life or personal liberty except according to procedure established by law.'",
    difficulty: "medium",
    pageReference: "Indian Polity",
    proofQuote: "Article 21 guarantees protection of life and personal liberty.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the chemical symbol for the precious metal Gold?",
    options: ["Ag", "Au", "Pt", "Fe"],
    correctAnswer: 1,
    explanation: "The chemical symbol for gold is Au, derived from the Latin word 'aurum' meaning shining dawn.",
    difficulty: "easy",
    pageReference: "Chemistry",
    proofQuote: "Gold's symbol Au comes from the Latin word aurum.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which Constitutional Amendment added Fundamental Duties under Article 51A of the Indian Constitution?",
    options: ["42nd Amendment Act, 1976", "44th Amendment Act, 1978", "86th Amendment Act, 2002", "73rd Amendment Act, 1992"],
    correctAnswer: 0,
    explanation: "The 42nd Constitutional Amendment Act, 1976 introduced Part IVA and Article 51A upon the recommendation of the Swaran Singh Committee.",
    difficulty: "medium",
    pageReference: "Indian Polity",
    proofQuote: "Fundamental Duties were incorporated into the Constitution by the 42nd Amendment Act in 1976.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the approximate speed of light in a vacuum?",
    options: ["300,000 km/s", "150,000 km/s", "30,000 km/s", "1,000,000 km/s"],
    correctAnswer: 0,
    explanation: "Light travels in vacuum at approximately 299,792 kilometers per second, commonly rounded to 300,000 km/s (3 × 10^8 m/s).",
    difficulty: "easy",
    pageReference: "Physics",
    proofQuote: "The speed of light in vacuum is defined as exactly 299,792,458 m/s.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which is the largest desert in the world by total surface area?",
    options: ["Sahara Desert", "Antarctic Polar Desert", "Gobi Desert", "Arabian Desert"],
    correctAnswer: 1,
    explanation: "The Antarctic Desert is the largest desert on Earth, spanning approximately 14.2 million square kilometers as a polar desert.",
    difficulty: "medium",
    pageReference: "World Geography",
    proofQuote: "Antarctica is technically the world's largest desert with extremely low annual precipitation.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Who is celebrated as the Father of the Indian Space Programme?",
    options: ["Dr. Homi Bhabha", "Dr. A.P.J. Abdul Kalam", "Dr. Vikram Sarabhai", "Satish Dhawan"],
    correctAnswer: 2,
    explanation: "Dr. Vikram Sarabhai initiated space research and helped establish the Indian National Committee for Space Research (later ISRO).",
    difficulty: "easy",
    pageReference: "Indian History & Science",
    proofQuote: "Dr. Vikram Sarabhai is universally regarded as the father of the Indian space programme.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the SI unit of electric current?",
    options: ["Volt", "Watt", "Ohm", "Ampere"],
    correctAnswer: 3,
    explanation: "The ampere (symbol: A) is the base SI unit of electric current named after French mathematician André-Marie Ampère.",
    difficulty: "easy",
    pageReference: "Physics",
    proofQuote: "The ampere is the base unit of electric current in the International System of Units.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "In which year was the historic Battle of Plassey fought in Bengal?",
    options: ["1757", "1764", "1857", "1761"],
    correctAnswer: 0,
    explanation: "The Battle of Plassey took place on 23 June 1757, where British East India Company forces led by Robert Clive defeated Nawab Siraj-ud-Daulah.",
    difficulty: "medium",
    pageReference: "Modern History",
    proofQuote: "The Battle of Plassey was fought on 23 June 1757 in Bengal.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Through which medium does sound travel the fastest?",
    options: ["Vacuum", "Gases (Air)", "Liquids (Water)", "Solids (Steel)"],
    correctAnswer: 3,
    explanation: "Because molecules in solids are densely packed, acoustic mechanical vibrations transmit significantly faster through solids like steel than liquids or air.",
    difficulty: "easy",
    pageReference: "General Science",
    proofQuote: "Sound waves travel fastest through dense solids due to tightly packed molecular bonds.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which vitamin plays an essential physiological role in blood coagulation (clotting)?",
    options: ["Vitamin A", "Vitamin C", "Vitamin K", "Vitamin D"],
    correctAnswer: 2,
    explanation: "Vitamin K is a cofactor required for the hepatic synthesis of prothrombin and clotting factors VII, IX, and X.",
    difficulty: "easy",
    pageReference: "Human Biology",
    proofQuote: "Vitamin K is essential for blood clotting and synthesis of prothrombin.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the pH value of pure distilled water at 25°C?",
    options: ["5.5", "7.0", "8.5", "0.0"],
    correctAnswer: 1,
    explanation: "Pure water has equal concentrations of hydrogen and hydroxide ions at 25°C, yielding a neutral pH of exactly 7.0.",
    difficulty: "easy",
    pageReference: "Chemistry",
    proofQuote: "Pure water at standard temperature has a neutral pH of 7.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which Indian state was the first to implement the three-tier Panchayati Raj system in 1959?",
    options: ["Gujarat", "Rajasthan", "Andhra Pradesh", "Uttar Pradesh"],
    correctAnswer: 1,
    explanation: "The Panchayati Raj system was first inaugurated in Nagaur district, Rajasthan on October 2, 1959 by Prime Minister Jawaharlal Nehru.",
    difficulty: "medium",
    pageReference: "Indian Polity",
    proofQuote: "Rajasthan became the first state in India to launch Panchayati Raj in Nagaur in 1959.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which mountain peak is the highest point situated within sovereign Indian territory?",
    options: ["Mount Everest", "Kanchenjunga", "Nanda Devi", "Kamet"],
    correctAnswer: 1,
    explanation: "Kanchenjunga stands at 8,586 meters on the India-Nepal border in Sikkim and is the highest peak in India and third highest on Earth.",
    difficulty: "medium",
    pageReference: "Indian Geography",
    proofQuote: "Kanchenjunga at 8,586 m is the highest mountain peak in India.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "In which city is the international headquarters of UNESCO located?",
    options: ["Geneva", "Paris", "New York", "Vienna"],
    correctAnswer: 1,
    explanation: "The United Nations Educational, Scientific and Cultural Organization (UNESCO) has its headquarters in Paris, France.",
    difficulty: "easy",
    pageReference: "International Organizations",
    proofQuote: "UNESCO is headquartered in Paris, France.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "In which year did Mahatma Gandhi lead the historic Dandi Salt March?",
    options: ["1920", "1930", "1942", "1919"],
    correctAnswer: 1,
    explanation: "The Salt Satyagraha began with the 24-day march from Sabarmati Ashram to Dandi from 12 March to 6 April 1930.",
    difficulty: "easy",
    pageReference: "Modern History",
    proofQuote: "The Salt March took place from March to April 1930.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which gas constitutes the greatest percentage of Earth's atmosphere by volume?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"],
    correctAnswer: 2,
    explanation: "Nitrogen comprises approximately 78.08% of Earth's atmosphere, followed by oxygen at approximately 20.95%.",
    difficulty: "easy",
    pageReference: "Earth Science",
    proofQuote: "Nitrogen gas makes up approximately 78% of dry atmospheric air.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What instrument is used to measure earthquake seismic wave magnitude?",
    options: ["Barometer", "Seismograph", "Anemometer", "Hygrometer"],
    correctAnswer: 1,
    explanation: "A seismograph records the vibrations and motion of the ground caused by seismic waves during an earthquake.",
    difficulty: "easy",
    pageReference: "Earth Science",
    proofQuote: "Seismographs are instruments used to record the motion of the ground during an earthquake.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Who was the first Indian woman to serve as President of the Indian National Congress?",
    options: ["Sarojini Naidu", "Annie Besant", "Sucheta Kripalani", "Vijaya Lakshmi Pandit"],
    correctAnswer: 0,
    explanation: "Sarojini Naidu presided over the Kanpur session of the Indian National Congress in 1925 as its first Indian woman president (Annie Besant was the first non-Indian woman in 1917).",
    difficulty: "medium",
    pageReference: "Modern History",
    proofQuote: "Sarojini Naidu became the first Indian woman President of the Congress in 1925.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "How many states in India does the Tropic of Cancer pass through?",
    options: ["6", "7", "8", "9"],
    correctAnswer: 2,
    explanation: "The Tropic of Cancer passes through 8 Indian states: Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura, and Mizoram.",
    difficulty: "medium",
    pageReference: "Indian Geography",
    proofQuote: "The Tropic of Cancer divides India into almost two equal halves, passing across 8 states.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the primary function of white blood cells (leukocytes) in human blood?",
    options: ["Oxygen transport", "Immune defense and fighting infection", "Blood clotting", "Nutrient absorption"],
    correctAnswer: 1,
    explanation: "Leukocytes are the immune cells of the circulatory system that defend the body against infectious disease and foreign invaders.",
    difficulty: "easy",
    pageReference: "Biology",
    proofQuote: "White blood cells defend the human body against infections and foreign pathogens.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Who authored the classical economic treatise 'The Wealth of Nations' published in 1776?",
    options: ["John Maynard Keynes", "Karl Marx", "Adam Smith", "David Ricardo"],
    correctAnswer: 2,
    explanation: "Scottish philosopher Adam Smith published 'The Wealth of Nations', considered the foundational magnum opus of classical economics.",
    difficulty: "easy",
    pageReference: "Economics",
    proofQuote: "Adam Smith published The Wealth of Nations in 1776.",
    citationType: "VERBATIM_PROOF"
  }
];

// Fallback bank for Current Affairs (Grounded dynamically in the current year)
const FALLBACK_CA_BANK: MCQQuestion[] = [
  {
    question: "Which country held the G20 Presidency leading major global economic and climate initiatives in 2024–2025?",
    options: ["Brazil", "India", "Indonesia", "South Africa"],
    correctAnswer: 0,
    explanation: "Brazil assumed the G20 Presidency following India, championing global inequality reduction and clean energy transitions.",
    difficulty: "medium",
    pageReference: "Global Summits & Diplomacy",
    proofQuote: "Brazil assumed the G20 leadership focusing on global governance reform and climate finance.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which multinational alliance formally expanded its membership by inducting Sweden as its 32nd member?",
    options: ["NATO", "BRICS", "ASEAN", "G7"],
    correctAnswer: 0,
    explanation: "Sweden officially completed its accession process to become the 32nd member of the North Atlantic Treaty Organization (NATO).",
    difficulty: "easy",
    pageReference: "Geopolitics & Defense",
    proofQuote: "Sweden officially became the 32nd member state of NATO.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the name of NASA's landmark lunar exploration program preparing astronauts for long-term lunar surface exploration?",
    options: ["Apollo Next", "Artemis Program", "Lunar Gateway-X", "Orion Horizon"],
    correctAnswer: 1,
    explanation: "The Artemis Program is NASA's flagship initiative to return humans to the Moon and establish sustainable lunar presence.",
    difficulty: "easy",
    pageReference: "Science & Space Tech",
    proofQuote: "NASA's Artemis program aims to land the first woman and first person of color on the Moon.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which continent's premier union of 55 member states was inducted as a permanent member of the G20?",
    options: ["African Union", "ASEAN", "OAS (Americas)", "Pacific Islands Forum"],
    correctAnswer: 0,
    explanation: "The African Union represents 55 member countries and was officially given permanent member status in the G20.",
    difficulty: "medium",
    pageReference: "International Relations",
    proofQuote: "The African Union is a permanent member of the G20 representing the African continent.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which international city hosted the Summer Olympic Games featuring the opening ceremony along the River Seine?",
    options: ["Paris", "Tokyo", "Los Angeles", "Rome"],
    correctAnswer: 0,
    explanation: "Paris hosted the Summer Olympic Games with an iconic opening ceremony along the Seine River.",
    difficulty: "easy",
    pageReference: "Sports & Global Events",
    proofQuote: "The Summer Olympic Games took place in Paris, France.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which space agency operates the Aditya-L1 solar observatory positioned at the Sun-Earth Lagrangian point L1?",
    options: ["ISRO (India)", "NASA (USA)", "JAXA (Japan)", "ESA (Europe)"],
    correctAnswer: 0,
    explanation: "ISRO operates the Aditya-L1 mission, which continuously observes the Sun's photosphere, chromosphere, and corona from the L1 halo orbit.",
    difficulty: "medium",
    pageReference: "Science & Space Tech",
    proofQuote: "Aditya-L1 is India's dedicated solar observatory operated by ISRO at the L1 point.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What major artificial intelligence milestone refers to models natively capable of processing text, audio, images, and video simultaneously?",
    options: ["Multimodal AI", "Quantum LLM", "Symbolic Computing", "Static Neural Networks"],
    correctAnswer: 0,
    explanation: "Multimodal AI models (such as Gemini and GPT-4o) are designed to natively reason across text, visual diagrams, code, and audio in real time.",
    difficulty: "easy",
    pageReference: "Technology & AI",
    proofQuote: "Multimodal AI models process and generate multiple data modalities simultaneously.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country is scheduled to host the UN Climate Change Conference COP29 in Baku?",
    options: ["Azerbaijan", "United Arab Emirates", "Egypt", "Kazakhstan"],
    correctAnswer: 0,
    explanation: "Azerbaijan was selected as the host country for COP29 held in its capital city of Baku.",
    difficulty: "medium",
    pageReference: "Environment & Global Summits",
    proofQuote: "COP29 is convened in Baku, Azerbaijan.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country won the ICC Men's T20 World Cup title held in the USA and West Indies in 2024?",
    options: ["India", "South Africa", "Australia", "England"],
    correctAnswer: 0,
    explanation: "India defeated South Africa in the thrilling final in Barbados to win the ICC Men's T20 World Cup.",
    difficulty: "easy",
    pageReference: "Sports Championships",
    proofQuote: "India won the ICC Men's T20 World Cup title in Barbados.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What term describes the global economic trade corridor initiative connecting India, the Middle East, and Europe?",
    options: ["IMEC (India-Middle East-Europe Economic Corridor)", "Silk Road 2.0", "Trans-Pacific Partnership", "Nordic-Baltic Corridor"],
    correctAnswer: 0,
    explanation: "IMEC is an infrastructure project aimed at boosting economic connectivity and clean energy trade across India, the Arabian Gulf, and Europe.",
    difficulty: "medium",
    pageReference: "Economy & Trade",
    proofQuote: "The India-Middle East-Europe Economic Corridor (IMEC) connects commercial ports across Asia and Europe.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Who was awarded the 2024 Nobel Prize in Physics for foundational discoveries enabling machine learning with artificial neural networks?",
    options: ["John J. Hopfield and Geoffrey E. Hinton", "Roger Penrose and Reinhard Genzel", "Syukuro Manabe and Klaus Hasselmann", "Alain Aspect and John Clauser"],
    correctAnswer: 0,
    explanation: "John J. Hopfield and Geoffrey E. Hinton were awarded the 2024 Nobel Prize in Physics for foundational discoveries and inventions that enable machine learning with artificial neural networks.",
    difficulty: "medium",
    pageReference: "Awards & Science",
    proofQuote: "Hopfield and Hinton were awarded the 2024 Nobel Prize in Physics for artificial neural network research.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which scientific team shared the 2024 Nobel Prize in Chemistry for breakthroughs in computational protein design and AlphaFold structure prediction?",
    options: ["David Baker, Demis Hassabis, and John Jumper", "Emmanuelle Charpentier and Jennifer Doudna", "Carolyn Bertozzi and Morten Meldal", "Moungi Bawendi and Louis Brus"],
    correctAnswer: 0,
    explanation: "David Baker won half the prize for computational protein design, and Demis Hassabis and John M. Jumper shared the other half for protein structure prediction using AlphaFold.",
    difficulty: "medium",
    pageReference: "Science & AI",
    proofQuote: "Baker, Hassabis, and Jumper were awarded the 2024 Nobel Prize in Chemistry for protein structure advances.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country achieved a historic double gold medal sweep in both Open and Women's sections at the 45th FIDE Chess Olympiad in Budapest?",
    options: ["India", "United States", "China", "Uzbekistan"],
    correctAnswer: 0,
    explanation: "India made history at the 45th FIDE Chess Olympiad in Budapest by winning gold medals in both the Open (led by D Gukesh) and Women's team sections.",
    difficulty: "easy",
    pageReference: "Sports Championships",
    proofQuote: "India won double gold at the 45th Chess Olympiad in Budapest.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which five countries formally joined the BRICS grouping as new members during its landmark expansion summit?",
    options: ["Egypt, Ethiopia, Iran, Saudi Arabia, and UAE", "Argentina, Turkey, Nigeria, Mexico, and Indonesia", "Kenya, Vietnam, Thailand, Malaysia, and Chile", "Poland, Qatar, Norway, New Zealand, and Singapore"],
    correctAnswer: 0,
    explanation: "BRICS formally inducted five new members: Egypt, Ethiopia, Iran, Saudi Arabia, and the United Arab Emirates (UAE).",
    difficulty: "medium",
    pageReference: "Geopolitics",
    proofQuote: "BRICS expanded to include Egypt, Ethiopia, Iran, Saudi Arabia, and UAE as full members.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the primary target of NASA's Europa Clipper spacecraft launched to investigate planetary habitability?",
    options: ["Jupiter's icy moon Europa", "Saturn's moon Titan", "Mars polar ice caps", "Venusian clouds"],
    correctAnswer: 0,
    explanation: "NASA's Europa Clipper mission is on a journey to Jupiter's ocean moon Europa to determine whether places below its icy crust could support life.",
    difficulty: "easy",
    pageReference: "Space Exploration",
    proofQuote: "Europa Clipper was launched to explore Jupiter's moon Europa and its subsurface ocean.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which iconic global landmark in Paris enabled Indian tourists to make instant payments using India's Unified Payments Interface (UPI)?",
    options: ["Eiffel Tower", "Louvre Museum", "Notre-Dame Cathedral", "Arc de Triomphe"],
    correctAnswer: 0,
    explanation: "India's UPI payment system was formally launched at the iconic Eiffel Tower in Paris, enabling Indian tourists to purchase tickets through QR code scans.",
    difficulty: "easy",
    pageReference: "Economy & Technology",
    proofQuote: "UPI was officially launched at the Eiffel Tower in France.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the official name of the lunar south pole landing point of India's Chandrayaan-3 lander approved by the IAU?",
    options: ["Shiv Shakti Point", "Tiranga Point", "Jawahar Point", "Atal Point"],
    correctAnswer: 0,
    explanation: "The landing site of Chandrayaan-3's Vikram lander near the Moon's south pole was officially named 'Shiv Shakti Point' by the International Astronomical Union.",
    difficulty: "easy",
    pageReference: "Science & Space Tech",
    proofQuote: "The Chandrayaan-3 touchdown site on the Moon is named Shiv Shakti Point.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which Indian public welfare scheme was launched with a ₹75,000 crore outlay to provide rooftop solar electricity for 1 crore households?",
    options: ["PM Surya Ghar: Muft Bijli Yojana", "PM KUSUM Yojana", "Ujala Scheme", "National Solar Mission"],
    correctAnswer: 0,
    explanation: "PM Surya Ghar: Muft Bijli Yojana provides substantial financial subsidies to install residential rooftop solar power systems for up to 10 million households.",
    difficulty: "easy",
    pageReference: "Government Schemes",
    proofQuote: "PM Surya Ghar: Muft Bijli Yojana provides rooftop solar systems for one crore households.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Where was the world's highest railway arch bridge, the Chenab Bridge standing 359 meters above the river bed, constructed?",
    options: ["Reasi, Jammu & Kashmir", "Shimla, Himachal Pradesh", "Dehradun, Uttarakhand", "Tawang, Arunachal Pradesh"],
    correctAnswer: 0,
    explanation: "The Chenab Rail Bridge in the Reasi district of Jammu and Kashmir spans 359 meters above the river bed, making it the highest railway bridge in the world.",
    difficulty: "easy",
    pageReference: "Infrastructure & National",
    proofQuote: "The Chenab Bridge in Jammu and Kashmir is the highest railway bridge in the world.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which global alliance was launched at the G20 New Delhi Summit by India, the USA, and Brazil to foster adoption of sustainable biofuels?",
    options: ["Global Biofuels Alliance (GBA)", "International Solar Alliance (ISA)", "Clean Hydrogen Coalition", "Global Methane Pledge"],
    correctAnswer: 0,
    explanation: "The Global Biofuels Alliance (GBA) was launched on the sidelines of the G20 Leaders' Summit to promote trade in clean biofuels and advance net-zero goals.",
    difficulty: "medium",
    pageReference: "Energy & Environment",
    proofQuote: "The Global Biofuels Alliance was launched by India, the US, and Brazil at the G20 Summit.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which Indian state has emerged as a key semiconductor manufacturing hub with Tata Electronics and Micron establishing mega chip fabrication/assembly plants?",
    options: ["Gujarat", "Karnataka", "Tamil Nadu", "Maharashtra"],
    correctAnswer: 0,
    explanation: "Sanand and Dholera in Gujarat have become premier centers for India's semiconductor fabrication and advanced packaging under the India Semiconductor Mission.",
    difficulty: "medium",
    pageReference: "Economy & Industry",
    proofQuote: "Gujarat hosts major semiconductor fabrication and testing facilities under the India Semiconductor Mission.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country won the Men's ICC Cricket World Cup 2023 held across India?",
    options: ["Australia", "India", "South Africa", "New Zealand"],
    correctAnswer: 0,
    explanation: "Australia defeated India in the final at Ahmedabad to win their sixth Men's Cricket World Cup championship.",
    difficulty: "easy",
    pageReference: "Sports Championships",
    proofQuote: "Australia won the ICC Men's Cricket World Cup 2023 title.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the mission objective of ISRO's NISAR satellite developed collaboratively with NASA?",
    options: ["Dual-frequency radar mapping of Earth's ecosystems and ice masses", "Deep space asteroid redirection", "Direct solar coronal mass emission sampling", "Lunar water extraction verification"],
    correctAnswer: 0,
    explanation: "NISAR (NASA-ISRO Synthetic Aperture Radar) uses dual L-band and S-band radar to track subtle changes in Earth's land surfaces, glaciers, and ecosystems.",
    difficulty: "medium",
    pageReference: "Science & Space Tech",
    proofQuote: "NISAR is a joint NASA-ISRO mission for high-resolution radar Earth observation.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which international organization declared 2025 as the International Year of Quantum Science and Technology (IYQ)?",
    options: ["United Nations (UN)", "World Economic Forum (WEF)", "International Science Council (ISC)", "OECD"],
    correctAnswer: 0,
    explanation: "The United Nations General Assembly officially proclaimed 2025 as the International Year of Quantum Science and Technology to celebrate 100 years of quantum mechanics.",
    difficulty: "medium",
    pageReference: "International Milestones",
    proofQuote: "The UN declared 2025 as the International Year of Quantum Science and Technology.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country hosted the 2024 Olympic Games with competitions in breakdancing and events in Tahiti for surfing?",
    options: ["France", "Japan", "Australia", "United Kingdom"],
    correctAnswer: 0,
    explanation: "France hosted the 2024 Paris Summer Olympics, which featured breakdancing in Paris and surfing competitions at Teahupo'o in Tahiti.",
    difficulty: "easy",
    pageReference: "Sports & Global Events",
    proofQuote: "France hosted the 2024 Olympic Games with events held across metropolitan France and Tahiti.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which Indian public initiative connects all panchayats with high-speed optical fiber digital connectivity?",
    options: ["BharatNet", "Digital India BHASHINI", "National Knowledge Network", "PM WANI"],
    correctAnswer: 0,
    explanation: "BharatNet is the government's flagship project creating an ultra-fast optical fiber broadband network connecting over 250,000 gram panchayats.",
    difficulty: "easy",
    pageReference: "National Policy & Tech",
    proofQuote: "BharatNet delivers high-speed broadband to rural gram panchayats across India.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "What is the name of the multi-nation military exercise hosted by India featuring air forces from countries including the US, UK, France, and Germany?",
    options: ["Tarang Shakti", "Yudh Abhyas", "Garuda", "Malabar"],
    correctAnswer: 0,
    explanation: "Exercise Tarang Shakti was India's largest multilateral air exercise, bringing together air forces from over 30 countries in two phases.",
    difficulty: "medium",
    pageReference: "Defense & Security",
    proofQuote: "Exercise Tarang Shakti is the largest multilateral air exercise conducted by the Indian Air Force.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which prominent Indian classical singer from the Kirana gharana was posthumously awarded the Bharat Ratna in 2024?",
    options: ["Dr. Bhupen Hazarika", "Pandit Bhimsen Joshi", "Karpoori Thakur and L.K. Advani alongside MS Swaminathan, PV Narasimha Rao & Charan Singh were honored", "M.S. Subbulakshmi"],
    correctAnswer: 2,
    explanation: "In 2024, the Bharat Ratna was conferred on Karpoori Thakur, L.K. Advani, P.V. Narasimha Rao, Chaudhary Charan Singh, and agricultural scientist M.S. Swaminathan.",
    difficulty: "medium",
    pageReference: "Awards & Honors",
    proofQuote: "Five distinguished personalities were conferred the Bharat Ratna in 2024.",
    citationType: "VERBATIM_PROOF"
  },
  {
    question: "Which country hosted the United Nations Biodiversity Conference COP16 in 2024 focusing on the Kunming-Montreal Global Biodiversity Framework?",
    options: ["Colombia (Cali)", "Canada (Montreal)", "Egypt (Sharm el-Sheikh)", "Costa Rica (San Jose)"],
    correctAnswer: 0,
    explanation: "The UN Biodiversity Conference COP16 was held in Cali, Colombia, focusing on implementing global targets to halt biodiversity loss by 2030.",
    difficulty: "medium",
    pageReference: "Environment & Ecology",
    proofQuote: "Cali, Colombia hosted the 2024 UN Biodiversity Conference COP16.",
    citationType: "VERBATIM_PROOF"
  }
];

export async function generateKnowledgeMCQs(
  topic: 'General Knowledge' | 'Current Affairs' | string,
  numQuestions: number = 10,
  customConfig?: CustomAIConfig
): Promise<MCQQuestion[]> {
  const prompt = KNOWLEDGE_PROMPT_TEMPLATE(topic, numQuestions);

  try {
    // Enforce 7.5s timeout on AI generation to guarantee Netlify serverless functions never time out
    const aiPromise = executeAIWithFallback(prompt, undefined, customConfig);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out (fast fallback)')), 7500)
    );
    const text = await Promise.race([aiPromise, timeoutPromise]);

    const rawArray = safeParseJSONArray(text);
    const validated = mcqSchema.safeParse(rawArray);

    if (validated.success && validated.data.length > 0) {
      // Validate that the generated questions are genuine knowledge questions (not meta prompt questions)
      const validQuestions = validated.data.filter((q) => {
        const lowerQ = q.question.toLowerCase();
        return !lowerQ.includes('provided document') &&
          !lowerQ.includes('in the document') &&
          !lowerQ.includes('the text mentions') &&
          !lowerQ.includes('according to the document');
      });

      if (validQuestions.length >= Math.min(5, numQuestions)) {
        return sanitizeCitations(validQuestions.slice(0, numQuestions), '');
      }
    }
  } catch (err) {
    console.warn(`[generateKnowledgeMCQs] AI generation error or timeout for ${topic}:`, err);
  }

  // Graceful Fallback to Curated High-Yield Bank
  console.log(`[generateKnowledgeMCQs] Using curated high-yield question bank for ${topic}`);
  const isCA =
    topic.toLowerCase().includes('current affair') ||
    topic.toLowerCase().includes('current event') ||
    topic.toLowerCase().includes('ca');
  const bank = isCA ? FALLBACK_CA_BANK : FALLBACK_GK_BANK;

  // Shuffle and return requested count
  const shuffled = [...bank].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numQuestions);
}

// Backward-compatible wrappers
export async function generateMCQs(
  pdfText: string,
  topic: string,
  numQuestions: number,
  customConfig?: CustomAIConfig
): Promise<MCQQuestion[]> {
  // If the user called generateMCQs for GK or Current Affairs without a real PDF document text
  if (!pdfText || pdfText.length < 100) {
    if (topic.toLowerCase().includes('general knowledge') || topic.toLowerCase().includes('current affair')) {
      return generateKnowledgeMCQs(topic, numQuestions, customConfig);
    }
  }
  return generateMCQsUniversal({ pdfText, topic, numQuestions, customConfig });
}

export async function generateMCQsFromPdfBuffer(
  pdfBuffer: Buffer,
  topic: string,
  numQuestions: number,
  customConfig?: CustomAIConfig
): Promise<MCQQuestion[]> {
  return generateMCQsUniversal({ pdfBuffer, isScanned: true, topic, numQuestions, customConfig });
}

export function isMetaOrAdministrativeQuestion(qText: string): boolean {
  if (!qText) return true;
  const lower = qText.toLowerCase();
  const metaIndicators = [
    'exam pattern',
    'total mark allocation',
    'mark allocation',
    'total marks',
    'duration of the preliminary exam',
    'duration of the main exam',
    'duration of the exam',
    'duration of the test',
    'time duration of',
    'how many minutes is the exam',
    'how many hours is the exam',
    'marking scheme',
    'negative marking',
    'eligibility criteria',
    'minimum age',
    'maximum age',
    'table of contents',
    'published on',
    'author of this document',
    'title of this pdf',
    'according to the index',
    'how many sections are in this exam',
    'how many total questions in this exam',
    'which section carries',
    'official notification',
    'application fee',
    'admit card',
  ];

  return metaIndicators.some((indicator) => lower.includes(indicator));
}

function sanitizeCitations(questions: any[], sourceText: string): MCQQuestion[] {
  return questions
    .filter((q) => {
      if (!q.question || !q.options || q.options.length !== 4 || q.correctAnswer < 0 || q.correctAnswer > 3) {
        return false;
      }
      // Filter out meta/administrative questions about exam duration, total marks, or document structure
      return !isMetaOrAdministrativeQuestion(q.question);
    })
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

