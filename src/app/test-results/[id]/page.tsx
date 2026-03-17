'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Loading from '@/app/loading';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface TestAttempt {
  id: string;
  testId: string;
  score: number;
  answers: number[];
  totalQuestions: number;
  questions: Question[];
  completedAt: string;
  updatedAt: string;
}

export default function TestResults() {
  const router = useRouter();
  const params = useParams();
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
        const response = await fetch(`/api/tests/attempts/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }
        const data = await response.json();
        setAttempt(data);
        
        // Trigger confetti for high scores
        const scorePercentage = Math.round((data.score / data.questions.length) * 100);
        if (scorePercentage >= 80) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#818cf8', '#fbbf24']
          });
        }
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
    return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  }

  if (!attempt) {
    return <div className="min-h-screen flex items-center justify-center">Results not found</div>;
  }

  const percentage = Math.round((attempt.score / attempt.questions.length) * 100);
  let rlt = percentage >= 50 ? "passed" : "failed";

  return (
    <div className="container mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <Card className="max-w-4xl mx-auto overflow-hidden shadow-2xl shadow-indigo-100 border-none">
          <CardHeader className="bg-white border-b py-8">
            <CardTitle className="text-gray-400 text-sm font-bold uppercase tracking-widest text-center">Test Results Identification</CardTitle>
            <p className="text-center font-mono text-gray-500">{attempt.id}</p>
          </CardHeader>
          <CardContent className="pt-12 px-8 pb-12">
            <div className="text-center mb-16 relative">
              {percentage >= 80 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
                  className="absolute -top-16 left-1/2 -translate-x-1/2 text-6xl pointer-events-none"
                >
                  🎉🏆✨
                </motion.div>
              )}
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="inline-block p-4 rounded-full bg-indigo-50 mb-6">
                  <h2 className="text-6xl font-black text-gray-900 leading-none">
                    <span className="text-indigo-600">{attempt.score}</span>
                    <span className="text-gray-300 text-3xl"> / {attempt.totalQuestions === 0 ? attempt.questions.length : attempt.totalQuestions}</span>
                  </h2>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-4 mb-8">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-4 bg-indigo-600 rounded-full max-w-md w-full overflow-hidden"
                  >
                    <div className="h-full bg-indigo-400 opacity-50 animate-pulse" />
                  </motion.div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-black text-gray-800">{percentage}%</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accuracy</span>
                    </div>
                    <div className="h-10 w-px bg-gray-100" />
                    <motion.p
                      className={`text-2xl font-black px-8 py-2 rounded-xl ${
                        rlt === "passed" ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                      animate={percentage >= 90 ? { scale: [1, 1.05, 1], filter: 'brightness(1.1)' } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {rlt === "passed" ? 'EXCELLENT' : 'KEEP TRYING'}
                    </motion.p>
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  Completed on{' '}
                  {new Date(attempt.updatedAt).toLocaleString('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </motion.div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Detailed Analysis</h3>
              {attempt.questions.map((question: any, index: number) => (
                <div
                  key={question.id || index}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    question.userAnswer === question.correctAnswer
                      ? 'bg-green-50/50 border-green-100'
                      : 'bg-red-50/50 border-red-100'
                  }`}
                >
                  <h3 className="font-bold mb-4 text-gray-800 flex gap-3">
                    <span className="bg-white rounded-lg px-2 py-1 shadow-sm text-sm border">{index + 1}</span>
                    {question.question}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {question.options.map((option: string, optionIndex: number) => {
                      const isCorrect = optionIndex === question.correctAnswer;
                      const isUserSelected = optionIndex === question.userAnswer;

                      const bgClass = isCorrect
                        ? 'bg-white border-green-500 text-green-700'
                        : isUserSelected
                        ? 'bg-white border-red-500 text-red-700'
                        : 'bg-gray-50/50 border-transparent text-gray-500';

                      return (
                        <div
                          key={optionIndex}
                          className={`p-3 rounded-xl border-2 transition-all flex justify-between items-center ${bgClass}`}
                        >
                          <span className="text-sm font-medium">{option}</span>
                          {isCorrect && <span className="text-xs font-black uppercase tracking-tighter">Correct</span>}
                          {isUserSelected && !isCorrect && <span className="text-xs font-black uppercase tracking-tighter">Error</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 pt-8 border-t flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" variant="outline" className="h-14 px-8 font-bold text-gray-600 rounded-xl" onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
              <Button size="lg" className="h-14 px-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-xl shadow-indigo-100" onClick={() => router.push(`/leaderboard/${attempt.testId}`)}>
                🏆 View Leaderboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}