import { GoogleGenAI } from '@google/genai';

export interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

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
