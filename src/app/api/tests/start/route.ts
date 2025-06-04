import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { GoogleGenAI } from '@google/genai';
import { authOptions } from '@/app/lib/auth';
import connectDB from '@/app/lib/mongodb';
import Test from '@/app/models/Test';
import Pdf from '@/app/models/Pdf';

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
// const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const predefinedTests = {
  'current-affairs': {
    title: 'Current Affairs Test',
    description: 'Test your knowledge of recent events and current affairs',
    duration: 30,
    questions: [
      {
        question: 'Who is the current Prime Minister of India?',
        options: ['Narendra Modi', 'Rahul Gandhi', 'Arvind Kejriwal', 'Mamata Banerjee'],
        correctAnswer: 0,
      },
      {
        question: 'Which country hosted the 2023 G20 Summit?',
        options: ['India', 'China', 'USA', 'Japan'],
        correctAnswer: 0,
      },
      {
        question: "What is the name of India's first space station?",
        options: ['Bharatiya Space Station', 'Aryabhata Station', 'Gaganyaan Station', 'None of the above'],
        correctAnswer: 0,
      },
      {
        question: 'Which country recently launched its first lunar rover?',
        options: ['India', 'Japan', 'Russia', 'China'],
        correctAnswer: 0,
      },
    ],
  },
  'general-knowledge': {
    title: 'General Knowledge Test',
    description: 'Test your general knowledge across various subjects',
    duration: 30,
    questions: [
      {
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 2,
      },
      {
        question: 'Which planet is known as the Red Planet?',
        options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
        correctAnswer: 1,
      },
      {
        question: 'Who painted the Mona Lisa?',
        options: ['Vincent van Gogh', 'Leonardo da Vinci', 'Pablo Picasso', 'Michelangelo'],
        correctAnswer: 1,
      },
      {
        question: 'What is the largest mammal in the world?',
        options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Polar Bear'],
        correctAnswer: 1,
      },
    ],
  },
};

async function parseGeminiResponse(responseText: string) {
  const parsed = JSON.parse(responseText);
  return parsed.map((q: any) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.options.indexOf(q.correctAnswer),
  }));
}

async function generateQuestionsFromPdf(content: string, referenceContent?: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  let prompt = `Generate 10 multiple choice questions based on the following content. Each question should have 4 options and one correct answer. Format the response as a JSON array of objects with the following structure:
  {
    "question": "question text",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "correct option"
  }

  Content:
  ${content}`;

  if (referenceContent) {
    prompt += `\n\nUse this reference content to determine the pattern and difficulty level:
    ${referenceContent}`;
  }

  try {
    const result = await model.generateContent(prompt);
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to get response from Gemini');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    // Remove markdown formatting if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const rawQuestions = JSON.parse(cleanText);

    const formattedQuestions = rawQuestions.map((q: any) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.options.indexOf(q.correctAnswer),
    }));

    return {
      title: 'PDF-Based Test',
      description: 'Test generated from your uploaded PDF content.',
      duration: 30,
      questions: formattedQuestions,
    };
  } catch (err) {
    console.error('Error generating questions from PDF:', err);
    throw new Error('Failed to generate questions from PDF content');
  }
}


async function generateGeneralKnowledgeQuestions() {
  const prompt = `Generate 10 general knowledge multiple choice questions. Include a mix of topics like history, science, geography, and culture. Each question should have 4 options and one correct answer. Format the response as a JSON array of objects with the following structure:
  {
    "question": "question text",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "correct option"
  }`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });
    
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to get response from Gemini');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    // Remove markdown formatting if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    const formatted = parsed.map((q: any) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.options.indexOf(q.correctAnswer),
    }));

    return {
      title: 'General Knowledge Test',
      description: 'Auto-generated GK quiz using Gemini',
      duration: 30,
      questions: formatted,
    };
  } catch (err) {
    console.error('Error in generateGeneralKnowledgeQuestions:', err);
    throw new Error('Failed to generate general knowledge questions');
  }
}

async function generateCurrentAffairsQuestions() {
  const prompt = `Generate 10 current affairs multiple choice questions about recent events (within the last month). Include a mix of topics like politics, technology, sports, and entertainment. Each question should have 4 options and one correct answer. Format the response as a JSON array of objects with the following structure:
  {
    "question": "question text",
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "correct option"
  }`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    });
    
    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Failed to get response from Gemini');
    }
    
    const text = result.candidates[0].content.parts[0].text;
    // Remove markdown formatting if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    const formatted = parsed.map((q: any) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.options.indexOf(q.correctAnswer),
    }));

    return {
      title: 'General Knowledge Test',
      description: 'Auto-generated GK quiz using Gemini',
      duration: 30,
      questions: formatted,
    };
  } catch (err) {
    console.error('Error in generateGeneralKnowledgeQuestions:', err);
    throw new Error('Failed to generate general knowledge questions');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, pdfIds } = await request.json();

    await connectDB();

    let testData;

    if (type === 'current-affairs') {
      testData = await generateCurrentAffairsQuestions();
    } else if (type === 'general-knowledge') {
      testData = await generateGeneralKnowledgeQuestions();
      } else if (predefinedTests[type]){
      testData = predefinedTests[test]
    } else if (pdfIds && Array.isArray(pdfIds) && pdfIds.length > 0) {
      // Handle PDF-based test
      const pdfs = await Pdf.find({
        _id: { $in: pdfIds },
        userId: session.user.id
      });

      if (pdfs.length === 0) {
        return NextResponse.json({ error: 'No PDFs found' }, { status: 404 });
      }

      const combinedMcqs = pdfs.flatMap(pdf => pdf.mcqs);

      if (combinedMcqs.length === 0) {
        return NextResponse.json({ error: 'No MCQs found in selected PDFs' }, { status: 400 });
      }

      testData = {
        title: pdfs.length === 1 
          ? `Test from ${pdfs[0].title}`
          : `Combined Test from ${pdfs.length} PDFs`,
        description: 'Test generated from your uploaded PDFs',
        duration: 30,
        questions: combinedMcqs,
      };
    } else {
      return NextResponse.json({ error: 'Invalid test type or PDF IDs' }, { status: 400 });
    }

    const test = await Test.create({
      ...testData,
      userId: session.user.id,
      totalMarks: testData.questions.length,
      passingMarks: Math.ceil(testData.questions.length * 0.6),
    });

    return NextResponse.json({
      success: true,
      testId: test._id,
      title: test.title,
      questionCount: testData.questions.length,
    });
  } catch (error) {
    console.error('Test creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
