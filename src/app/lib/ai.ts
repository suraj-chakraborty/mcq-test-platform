import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const mcqSchema = z.array(z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string(),
}));

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function generateMCQs(pdfText: string, topic: string, numQuestions: number): Promise<MCQQuestion[]> {
  const truncatedText = pdfText.slice(0, 6000);
  //   const prompt = `
  // You are a teaching assistant.
  // The topic for these questions is: **${topic}**.

  // Your task is to generate ${numQuestions} multiple-choice questions (MCQs) *strictly and exclusively* based on the provided "PDF Content" below, and relevant to the specified topic. Ensure that every question, its options, and the correct answer can be directly inferred or found within the given text. Do not introduce any outside information or concepts *until you are completely sure about the information*.

  // Each question should have:

  //  - "question": The question statement
  //  - "options": An array of 4 answer options
  //  - "correctAnswer": Index of the correct option (0-based)
  //  - "explanation": A brief explanation of the answer, referencing the provided text where applicable.

  // Return the response EXACTLY as a JSON array (do not wrap it in an object):
  // [
  //   {
  //     "question": "Sample text",
  //     "options": ["A", "B", "C", "D"],
  //     "correctAnswer": 0,
  //     "explanation": "Because..."
  //   }
  // ]

  // PDF Content:
  // """
  // ${truncatedText}
  // """`;
  const prompt = `
You are an advanced AI Question Generator capable of adapting your expertise dynamically across domains such as:
- Academic subjects (Science, History, Economics, etc.)
- General Knowledge
- Current Affairs (recent events)
- Document-based learning (PDF content)

---

### CONTEXT
Topic: **${topic}**
Number of Questions: ${numQuestions}

### SOURCE PRIORITY LOGIC (STRICT)

1. If "PDF Content" is meaningful:
   → Generate questions STRICTLY from it
   → Do NOT introduce external knowledge unless absolutely necessary

2. If PDF Content is weak/empty:
   → Use your internal knowledge based on the topic

3. If topic implies "recent events" (e.g., current affairs, recent news):
   → Focus ONLY on the latest reliable information
   → Avoid outdated facts

---
### CURRENT AFFAIRS TIME RULE (CRITICAL)

If the topic includes Current Affairs / Recent Events:
→ Focus ONLY on events from the **last 8–12 months**
→ Prefer:
   - Major government decisions
   - International events
   - Important tech launches
   - Sports winners & tournaments
   - Awards & recognitions,${topic} etc

→ Avoid:
   - Very recent breaking news (unstable)
   - Outdated (>1 year old) events

---

### ADAPTIVE QUESTION STRATEGY

Dynamically adjust based on content type:

- If factual content → Use direct MCQs
- If conceptual → Use reasoning-based questions
- If event-based → Focus on outcomes, dates, significance
- If dense PDF → Extract key insights and convert to questions

---

### DIFFICULTY DISTRIBUTION

- 30% Easy (direct recall)
- 50% Medium (understanding-based)
- 20% Hard (analytical / tricky)

---

### DISTRACTOR ENGINEERING (VERY IMPORTANT)

Each question must have 4 high-quality options:
- All options must be plausible
- Avoid obvious wrong answers
- Use close variations, logical traps, or related concepts

---

### QUESTION VARIETY

Include a mix of:
- Direct factual questions
- Conceptual understanding
- Statement-based (which are correct?)
- Assertion-Reason (if applicable)

---

### EXPLANATION RULES

- Clearly justify the correct answer
- Keep concise but informative
- Reference PDF content when used

---

### STRICT OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no extra text):

[
  {
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Explanation"
  }
]

---

### VALIDATION BEFORE OUTPUT

- Ensure exactly ${numQuestions} questions
- No duplicates
- No vague wording
- Ensure JSON is perfectly valid

---

### PDF CONTENT
"""
${truncatedText}
"""
`;
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!result.text) {
      throw new Error("No text returned by Gemini");
    }

    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch (e) {
      console.error("Gemini JSON Parse Error:", e, result.text);
      return [];
    }

    const validation = mcqSchema.safeParse(parsed);
    if (!validation.success) {
      console.error("Gemini Validation Error:", validation.error.format());
      return [];
    }

    return validation.data;
  } catch (error) {
    console.error('Gemini MCQ generation error:', error);
    return [];
  }
}

