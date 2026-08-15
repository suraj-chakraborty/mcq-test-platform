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
  const models = customModel
    ? [customModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro']
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
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
- ALL QUESTIONS MUST BE STRICTLY FROM **${currentYear}** (Specifically **${currentMonthName} ${currentYear}** and recent months of **${currentYear}**).
- NEVER generate questions from outdated past years (such as 2022, 2023, or 2024). Questions MUST test actual current events of ${currentYear}.
============================================================

Your task is to generate **${numQuestions}** authentic, high-yield, factually accurate Multiple-Choice Questions (MCQs) on **RECENT CURRENT AFFAIRS OF ${currentYear}**.

----------------------
CURRENT AFFAIRS DOMAIN COVERAGE (Distribute questions across these areas):
----------------------
1. **National & Global Summits / Geopolitics (${currentYear})**: G20, BRICS, SCO, UN General Assembly, COP climate summits, bilateral accords, current international treaties.
2. **Science, Space & Emerging Technology (${currentYear})**: Active space missions (ISRO, NASA, ESA, Artemis, Lunar & Solar missions), latest AI models & breakthroughs, defense & missile tests, renewable energy innovations.
3. **Economy, Banking & Trade (${currentYear})**: Current GDP rankings, latest central bank / RBI repo rates and monetary policy, budget allocations, major economic corridors and global trade agreements.
4. **Awards, Honors & Milestones (${currentYear})**: Latest national and international awards, civilian honors, prestigious recognitions.
5. **Sports Championships (${currentYear})**: Current sports championships, tournament winners, record milestones, Grand Slam tennis, chess olympiads.
6. **Environment, Climate & Ecology (${currentYear})**: Current global climate milestones, new wildlife reserves, international conservation agreements.
7. **Government Schemes & National Policy (${currentYear})**: Landmark welfare schemes, digital public infrastructure, health & education initiatives launched or active in ${currentYear}.

----------------------
STRICT GENERATION RULES:
----------------------
- **REAL FACTS ONLY**: Every question MUST test real-world events, true facts, actual personalities, correct organizations, and official dates of ${currentYear}.
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
    "question": "Which country is hosting the major multilateral climate and economic dialogues in ${currentYear}?",
    "options": ["India", "Brazil", "South Africa", "United States"],
    "correctAnswer": 1,
    "explanation": "Brazil assumed the G20 presidency and hosted key multilateral climate and economic dialogues throughout ${currentYear}.",
    "difficulty": "medium",
    "pageReference": "Global Summits & Geopolitics",
    "proofQuote": "Brazil hosts major international summit proceedings in ${currentYear}.",
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
  }
];

export async function generateKnowledgeMCQs(
  topic: 'General Knowledge' | 'Current Affairs' | string,
  numQuestions: number = 10,
  customConfig?: CustomAIConfig
): Promise<MCQQuestion[]> {
  const prompt = KNOWLEDGE_PROMPT_TEMPLATE(topic, numQuestions);

  try {
    const text = await executeAIWithFallback(prompt, undefined, customConfig);
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
    console.warn(`[generateKnowledgeMCQs] AI generation error for ${topic}:`, err);
  }

  // Graceful Fallback to Curated High-Yield Bank
  console.log(`[generateKnowledgeMCQs] Using curated high-yield question bank for ${topic}`);
  const isCA = topic.toLowerCase().includes('current affair') || topic.toLowerCase().includes('current event');
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

