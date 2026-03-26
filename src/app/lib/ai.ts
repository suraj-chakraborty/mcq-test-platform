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

export const getGenAIInstance = () => {
  const keysString = process.env.GOOGLE_AI_API_KEYS;
  if (keysString) {
    const keys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      return new GoogleGenAI({ apiKey: randomKey });
    }
  }
  return new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
};

export async function generateMCQs(pdfText: string, topic: string, numQuestions: number): Promise<MCQQuestion[]> {
  const truncatedText = pdfText.slice(0, 6000);
  const prompt = `
You are an expert MCQ generator and assessment designer.

Your task is to generate high-quality multiple-choice questions based on the given inputs.

----------------------
INPUT
----------------------
Topic: ${topic}
Number of Questions: ${numQuestions}

PDF Content:
"""
${truncatedText}
"""

----------------------
SOURCE RULES (STRICT)
----------------------
- If the PDF content contains sufficient information:
  → Generate ALL questions strictly from it
  → Do NOT introduce external knowledge

- If the PDF content is insufficient or unclear:
  → Use accurate internal knowledge relevant to the topic

----------------------
DATA FILTERING RULES (CRITICAL)
----------------------
- DO NOT generate questions about coaching classes, institute names, tutor names, or promotional material.
- DO NOT generate questions about phone numbers, email addresses, websites, or contact information found in the text.
- Ignore headers, footers, page numbers, and irrelevant administrative details.
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

----------------------
DIFFICULTY DISTRIBUTION
----------------------
- 30% Easy (direct facts)
- 50% Medium (conceptual understanding)
- 20% Hard (analytical or tricky)

----------------------
OPTIONS (CRITICAL)
----------------------
- Exactly 4 options per question
- All options must be plausible and relevant
- Avoid obviously incorrect or joke answers
- Randomize correct answer positions

----------------------
EXPLANATIONS
----------------------
- Clearly explain WHY the correct answer is correct
- Keep concise (1–3 sentences)
- Reference the PDF content when applicable

----------------------
OUTPUT FORMAT (STRICT)
----------------------
Return ONLY valid JSON. No markdown, no extra text.

[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctAnswer": number,
    "explanation": "string"
  }
]

----------------------
VALIDATION RULES
----------------------
- Exactly ${numQuestions} questions
- No duplicate questions
- No duplicate options within a question
- Ensure JSON is valid and parseable
- correctAnswer must be an index (0–3)

----------------------
FINAL INSTRUCTION
----------------------
Generate the output now.
`;
  try {
    const genAI = getGenAIInstance();
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

export async function generateMCQsFromPdfBuffer(pdfBuffer: Buffer, topic: string, numQuestions: number): Promise<MCQQuestion[]> {
  const prompt = `
You are an expert MCQ generator and assessment designer.

Your task is to generate high-quality multiple-choice questions based on the attached PDF document.
You have native vision and document understanding capabilities. Please read the document thoroughly.

----------------------
INPUT
----------------------
Topic: ${topic}
Number of Questions: ${numQuestions}

----------------------
SOURCE RULES (STRICT)
----------------------
- Extract information directly from the text, images, charts, and diagrams in the PDF.
- If the PDF content contains sufficient information:
  → Generate ALL questions strictly from it
  → Do NOT introduce external knowledge
- If the PDF content is insufficient or unclear:
  → Use accurate internal knowledge relevant to the topic

----------------------
DATA FILTERING RULES (CRITICAL)
----------------------
- DO NOT generate questions about coaching classes, institute names, tutor names, or promotional material present in the PDF.
- DO NOT generate questions about phone numbers, email addresses, websites, or contact information.
- Ignore watermarks, headers, footers, page numbers, and irrelevant administrative details.
- Focus strictly on academic, conceptual, or topical knowledge related to the subject.

----------------------
QUESTION PATTERNS & FORMATTING (CRITICAL)
----------------------
Generate a diverse mixture of question patterns based on the given context to make the test engaging.
Strongly enforce a mixture of the following formats:
1. **Standard Single Correct**: Direct question with 4 options.
2. **Passage/Scenario-Based**: Provide a detailed paragraph or scenario *inside the 'question' field itself*, followed by a specific question based on it. Use double newlines (\n\n) to separate the scenario from the question.
3. **Assertion-Reasoning**: Use **Assertion (A):** and **Reason (R):** on separate lines. The 4 options must be the standard evaluative choices.

4. **Matching Type**: Present **List I** and **List II** to be matched. 
   - **List I** must use labels A, B, C, D.
   - **List II** must use labels 1, 2, 3, 4.
   - **CRITICAL FORMAT:** You MUST put each item on a NEW LINE.
   - **EXAMPLE STRUCTURE:**
     Match the indicators with their values:
     
     **List I**
     A. Fiscal Deficit
     B. CPI Inflation
     C. GDP Growth
     D. Repo Rate
     
     **List II**
     1. 4.5%
     2. 5.1%
     3. 7.2%
     4. 6.5% The 4 options must be combinations like 'A-1, B-2, C-3, D-4'.
5. **Multiple Statements**: Use **Statement I**, **Statement II**, etc., on separate lines. The 4 options should ask which are correct.

**FORMATTING RULES:**
- Use **double newlines (\n\n)** between major sections (e.g., between a passage and the question).
- Use **bold markdown (**text**)** for headers like **List I**, **List II**, **Assertion (A)**, **Reason (R)**, and **Statement I**.
- Keep the overall question clear and professional.
- YOU MUST USE ESCAPED NEWLINES (\n) IN THE JSON RESPONSE TO SEPARATE THESE SECTIONS. DO NOT PUT EVERYTHING ON ONE LINE.

----------------------
QUESTION DESIGN & FORMAT RULES
----------------------
- CRITICAL: REGARDLESS of the pattern used above, every single question MUST be formatted to have EXACTLY 4 distinct options, and EXACTLY ONE correct answer index (0-3).
- Do NOT generate actual multi-select or 'true/false' questions unless they are adapted to fit the standard 4-option single-select format as described above.
- Each question must test understanding, not just recall
- Avoid vague or ambiguous wording
- Ensure each question is clearly answerable

----------------------
DIFFICULTY DISTRIBUTION
----------------------
- 30% Easy (direct facts)
- 50% Medium (conceptual understanding)
- 20% Hard (analytical or tricky)

----------------------
OPTIONS (CRITICAL)
----------------------
- Exactly 4 options per question
- All options must be plausible and relevant
- Avoid obviously incorrect or joke answers
- Randomize correct answer positions

----------------------
EXPLANATIONS
----------------------
- Clearly explain WHY the correct answer is correct
- Keep concise (1–3 sentences)
- Reference the PDF content when applicable

----------------------
OUTPUT FORMAT (STRICT)
----------------------
Return ONLY valid JSON. No markdown, no extra text.

[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctAnswer": number,
    "explanation": "string"
  }
]

----------------------
VALIDATION RULES
----------------------
- Exactly ${numQuestions} questions
- No duplicate questions
- No duplicate options within a question
- Ensure JSON is valid and parseable
- correctAnswer must be an index (0–3)

----------------------
FINAL INSTRUCTION
----------------------
Generate the output now.
`;

  try {
    const genAI = getGenAIInstance();
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: pdfBuffer.toString("base64"),
            mimeType: "application/pdf"
          }
        },
        prompt
      ],
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
      console.error("Gemini JSON Parse Error in Buffer Mode:", e, result.text);
      return [];
    }

    const validation = mcqSchema.safeParse(parsed);
    if (!validation.success) {
      console.error("Gemini Validation Error in Buffer Mode:", validation.error.format());
      return [];
    }

    return validation.data;
  } catch (error) {
    console.error('Gemini Buffer MCQ generation error:', error);
    return [];
  }
}

