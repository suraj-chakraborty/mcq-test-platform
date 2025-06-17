import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import DescriptiveTest from '@/app/models/DescriptiveTest';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { examName, question, answer, wordCount, timeLimit, timeTaken } = await request.json();
    console.log(examName, question, answer, wordCount, timeLimit, timeTaken);

    await connectDB();

    // Generate feedback using Gemini AI
    // const model = genAI.GoogleGenAI({ model: 'gemini-2.0-flash' });
    const prompt = `
      You are an expert evaluator for ${examName} descriptive writing section.
      Please evaluate the following answer and provide detailed feedback:
      
      Question: ${question}
      Answer: ${answer}
      
      Please provide:
      1. A score out of 100
      2. Detailed feedback on content, structure, and language
      3. List of strengths
      4. List of areas to improve
      5. Specific suggestions for improvement
      
      Format the response as a JSON object with these fields:
      {
        "score": number,
        "feedback": string,
        "strengths": string[],
        "areasToImprove": string[],
        "suggestions": string[]
      }
    `;

    const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: ([prompt]),
    });
    // console.log(result);
    // const response = await result.response;
    // console.log(response);
    // const text = result.candidates[0]?.content?.parts[0]?.text;
    const text =
      result?.candidates &&
      Array.isArray(result.candidates) &&
      result.candidates[0]?.content?.parts &&
      Array.isArray(result.candidates[0].content.parts) &&
      result.candidates[0].content.parts[0]?.text
        ? result.candidates[0].content.parts[0].text
        : undefined;

    // console.log("text", text);

    if (!text) {
      throw new Error('No text response from Gemini API');
    }

    let evaluation;
        try {
        const cleanedText = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```$/, '')
            .trim();

        evaluation = JSON.parse(cleanedText);
        } catch (err) {
        console.error("Failed to parse evaluation JSON:", err);
        throw new Error("Gemini returned invalid JSON. Raw response:\n" + text);
        }

    // Save the test result
    const descriptiveTest = await DescriptiveTest.create({
      userId: session.user.id,
      examName,
      question,
      answer,
      wordCount,
      timeLimit,
      timeTaken,
      ...evaluation
    });

    return NextResponse.json({
      success: true,
      test: descriptiveTest
    });

  } catch (error) {
    console.error('Error evaluating descriptive answer:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
} 