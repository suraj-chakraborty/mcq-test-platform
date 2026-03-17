'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/app/components/Skeleton';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
}

interface TestData {
  id: string;
  questions: Question[];
  testType: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  completed?: boolean;
}

export default function TestPage() {
  const params = useParams();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-2xl w-full mx-auto px-4">
          <div className="bg-white p-8 rounded-xl shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-3/4 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-700">
                Question <span className="text-indigo-600 font-bold">{currentQuestion + 1}</span> of {test.questions.length}
              </h2>
              <div className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Score: {test.score}
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-2 bg-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestion + 1) / test.questions.length) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-8"
            >
              <p className="text-xl font-semibold text-gray-800 leading-relaxed">
                {question.question}
              </p>

              <div className="grid gap-3">
                {question.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleAnswer(option)}
                    disabled={submitting}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      submitting
                        ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50'
                        : 'border-gray-100 hover:border-indigo-600 hover:bg-indigo-50/30 bg-white text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold text-sm">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-lg">{option}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 