import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export async function generateMCQs(content: string, numQuestions: number = 10): Promise<MCQQuestion[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Based on the following text, generate ${numQuestions} multiple choice questions. 
    Format each question as a JSON object with the following structure:
    {
      "question": "The question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0, // Index of the correct answer (0-3)
      "explanation": "Explanation of why this is the correct answer"
    }
    
    Return the questions as a JSON array.
    
    Text to generate questions from:
    ${content}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    try {
      const questions = JSON.parse(responseText);
      return questions;
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      throw new Error('Failed to parse MCQ questions');
    }
  } catch (error) {
    console.error('Error generating MCQs:', error);
    throw new Error('Failed to generate MCQ questions');
  }
} 