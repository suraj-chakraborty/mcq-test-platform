'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

interface TestData {
  _id: string;
  questions: Question[];
  testType: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  completed?: boolean;
}

export default function TestPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [test, setTest] = useState<TestData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }

    fetchTest();
  }, [session, router, params.id]);

  const fetchTest = async () => {
    try {
      const res = await fetch(`/api/tests/${params.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch test');
      }

      setTest(data.test);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An error occurred while fetching the test');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!test || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tests/${params.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIndex: currentQuestion,
          answer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit answer');
      }

      setTest(data.test);

      if (currentQuestion < test.questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An error occurred while submitting the answer');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading test...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Test not found</div>
      </div>
    );
  }

  if (currentQuestion >= test.questions.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold mb-6">Test Complete!</h1>
          
          <div className="space-y-4">
            <p className="text-lg">
              Total Questions: {test.totalQuestions}
            </p>
            <p className="text-lg text-green-600">
              Correct Answers: {test.correctAnswers}
            </p>
            <p className="text-lg text-red-600">
              Wrong Answers: {test.wrongAnswers}
            </p>
            <p className="text-xl font-semibold">
              Final Score: {test.score}
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="mt-8 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const question = test.questions[currentQuestion];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">
              Question {currentQuestion + 1} of {test.questions.length}
            </h2>
            <div className="text-sm text-gray-500">
              Score: {test.score}
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-indigo-600 rounded-full"
              style={{
                width: `${((currentQuestion + 1) / test.questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-lg font-medium">{question.question}</p>

          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={submitting}
                className={`w-full text-left p-4 rounded-lg border ${
                  submitting
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 