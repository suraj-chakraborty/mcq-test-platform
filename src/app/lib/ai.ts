import { GoogleGenAI } from '@google/genai';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function generateMCQs(pdfText: string): Promise<MCQQuestion[]> {
 const truncatedText = pdfText.slice(0, 6000);
  const prompt = `
You are a teaching assistant. Based on the following PDF content, generate 10 multiple-choice questions (MCQs). Each question should have:

- "question": The question statement
- "options": An array of 4 answer options
- "correctAnswer": Index of the correct option (0-based)
- "explanation": A brief explanation of the answer

Return the response as a JSON array.

PDF Content:
"""
${truncatedText}
"""`;

  try {
    const result = await genAI.models.generateContentStream({
        model: 'gemini-2.0-flash-001',
        contents: prompt,
      });
      // console.log('Gemini MCQ generation result:', result);
     let fullResponse = '';
    for await (const chunk of result) {
      fullResponse += chunk.text;
    }

    const cleanText = fullResponse.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    // console.log(parsed)
    return parsed;
  } catch (error) {
    console.error('Gemini MCQ generation error:', error);
    return [];
  }
}
