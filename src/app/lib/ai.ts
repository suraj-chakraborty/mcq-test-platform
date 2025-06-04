import { GoogleGenAI } from '@google/genai';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function generateMCQs(pdfText: string): Promise<MCQQuestion[]> {

  const prompt = `
You are a teaching assistant. Based on the following PDF content, generate 3 multiple-choice questions (MCQs). Each question should have:

- "question": The question statement
- "options": An array of 4 answer options
- "correctAnswer": Index of the correct option (0-based)
- "explanation": A brief explanation of the answer

Return the response as a JSON array.

PDF Content:
"""
${pdfText}
"""`;

  try {
    const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: prompt,
      });
      if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Failed to get response from Gemini');
      }
      const text = result.candidates[0].content.parts[0].text;
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    return parsed;
  } catch (error) {
    console.error('Gemini MCQ generation error:', error);
    return [];
  }
}
