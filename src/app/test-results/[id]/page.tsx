'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TestAttempt {
  _id: string;
  score: number;
  answers: number[];
  totalQuestions: number;
  questions: Question[];
  completedAt: string;
  updatedAt: string;
}

export default function TestResults({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        console.log("params", params)
        const response = await fetch(`/api/tests/attempts/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }
        const data = await response.json();
        console.log("data", data)
        setAttempt(data);
      } catch (error) {
        toast.error('Failed to load results');
        console.error('Error fetching results:', error);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchResults();
    }
  }, [session, params.id, router]);

  if (status === 'loading' || loading) {
    return <div>Loading...</div>;
  }

  if (!attempt) {
    // console.log("attempt", attempt)
    return <div>Results not found</div>;
  }
  console.log("attempt", attempt)
  const percentage = Math.round((attempt.score / attempt.questions.length) * 100);
  console.log("percentage", percentage)
  let rlt = percentage >= 50 ? "passed": "failed";
  

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Results - {attempt._id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">
              Score: {attempt.score}/{attempt.totalQuestions==0?attempt.questions.length:attempt.totalQuestions}
            </h2>
            <p className="text-xl text-gray-600">{percentage}%</p>
            <p
              className={`mt-2 text-lg font-semibold ${
                rlt==="passed" ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {rlt==="passed" ? '✅ Passed' : '❌ Failed'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Completed on{' '}
              {new Date(attempt.updatedAt).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
          </div>

          <div className="space-y-6">
            {attempt.questions.map((question: any, index: number) => (
              <div
                key={question._id}
                className={`p-4 rounded-lg ${
                  question.userAnswer === question.correctAnswer
                    ? 'bg-green-50'
                    : 'bg-red-50'
                }`}
              >
                <h3 className="font-medium mb-2">
                  Question {index + 1}: {question.question}
                </h3>
                <div className="space-y-2">
                  {question.options.map((option: string, optionIndex: number) => {
                    const isCorrect = optionIndex === question.correctAnswer;
                    const isUserSelected = optionIndex === question.userAnswer;

                    const bgClass = isCorrect
                      ? 'bg-green-100 border-green-400'
                      : isUserSelected
                      ? 'bg-red-100 border-red-400'
                      : 'bg-gray-50 border-gray-200';

                    return (
                      <div
                        key={optionIndex}
                        className={`p-2 rounded border ${bgClass}`}
                      >
                        {option}
                        {isCorrect && (
                          <span className="ml-2 text-green-600 font-bold">✓</span>
                        )}
                        {isUserSelected && !isCorrect && (
                          <span className="ml-2 text-red-600 font-bold">✗</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Button onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 