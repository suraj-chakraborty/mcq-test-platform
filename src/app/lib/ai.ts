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

export async function generateMCQs(pdfText: string, topic:string, numQuestions:number): Promise<MCQQuestion[]> {
  const truncatedText = pdfText.slice(0, 6000);
  const prompt = `
You are a teaching assistant.
The topic for these questions is: **${topic}**.

Your task is to generate ${numQuestions} multiple-choice questions (MCQs) *strictly and exclusively* based on the provided "PDF Content" below, and relevant to the specified topic. Ensure that every question, its options, and the correct answer can be directly inferred or found within the given text. Do not introduce any outside information or concepts *until you are completely sure about the information*.

Each question should have:

 - "question": The question statement
 - "options": An array of 4 answer options
 - "correctAnswer": Index of the correct option (0-based)
 - "explanation": A brief explanation of the answer, referencing the provided text where applicable.

Return the response EXACTLY as a JSON array (do not wrap it in an object):
[
  {
    "question": "Sample text",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": 0,
    "explanation": "Because..."
  }
]

PDF Content:
"""
${truncatedText}
"""`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
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

