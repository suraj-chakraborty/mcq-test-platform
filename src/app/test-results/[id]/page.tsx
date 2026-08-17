'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LoadingSpinner as Loading } from '@/app/components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { FormattedHeader } from '@/app/components/FormattedHeader';
import confetti from 'canvas-confetti';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  proofQuote?: string;
  pageReference?: string;
  citationType?: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION';
}

interface TestAttempt {
  id: string;
  testId: string;
  score: number;
  answers: number[];
  totalQuestions: number;
  questions: Question[];
  xpEarned?: number;
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

  // If user in result section tries to go back, send them to dashboard instead of the test
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      router.replace('/dashboard');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);

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
        const totalQs = data.totalQuestions || data.questions?.length || 1;
        const scorePercentage = Math.round((data.score / totalQs) * 100);
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
    return <Loading message="Loading test results..." />;
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-neutral-950 p-4">
        <div className="text-center p-8 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm max-w-md">
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-2">Results Not Found</h2>
          <p className="text-xs text-gray-500 mb-6">The requested test results could not be located or may have been removed.</p>
          <Button onClick={() => router.push('/dashboard')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const totalQs = attempt.totalQuestions || attempt.questions?.length || 1;
  const percentage = Math.round((attempt.score / totalQs) * 100);
  let rlt = percentage >= 50 ? "passed" : "failed";

  return (
    <div className="container mx-auto py-4 sm:py-8 px-2.5 sm:px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, type: "spring" }}
      >
        <Card className="max-w-4xl mx-auto overflow-hidden shadow-2xl shadow-indigo-100 dark:shadow-none border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl">
          <CardHeader className="bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 py-4 sm:py-6 px-4 sm:px-6">
            <CardTitle className="text-gray-400 text-xs sm:text-sm font-black uppercase tracking-widest text-center">Test Performance Summary</CardTitle>
            <p className="text-center font-mono text-gray-500 text-xs truncate max-w-xs mx-auto">{attempt.id}</p>
          </CardHeader>
          <CardContent className="pt-6 sm:pt-10 px-3.5 sm:px-8 pb-8 sm:pb-12">
            <div className="text-center mb-8 sm:mb-12 relative">
              {percentage >= 80 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
                  className="absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 text-4xl sm:text-6xl pointer-events-none"
                >
                  🎉🏆✨
                </motion.div>
              )}

              <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="inline-block p-3 sm:p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 mb-4 sm:mb-6">
                  <h2 className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white leading-none">
                    <span className="text-indigo-600 dark:text-indigo-400">{attempt.score}</span>
                    <span className="text-gray-300 dark:text-gray-600 text-2xl sm:text-3xl font-semibold"> / {attempt.totalQuestions || attempt.questions?.length || 0}</span>
                  </h2>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8 max-w-md mx-auto">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="h-3 sm:h-4 bg-indigo-600 rounded-full w-full overflow-hidden"
                  >
                    <div className="h-full bg-indigo-400 opacity-50 animate-pulse" />
                  </motion.div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 sm:gap-6 w-full pt-2">
                    <div className="flex flex-col items-center px-2">
                      <span className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white">{percentage}%</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accuracy</span>
                    </div>
                    {attempt.xpEarned ? (
                      <>
                        <div className="h-8 w-px bg-gray-200 dark:bg-neutral-800 hidden sm:block" />
                        <div className="flex flex-col items-center px-2">
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400"
                          >
                            +{attempt.xpEarned}
                          </motion.span>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">XP Earned</span>
                        </div>
                      </>
                    ) : null}
                    <div className="h-8 w-px bg-gray-200 dark:bg-neutral-800 hidden sm:block" />
                    <motion.p
                      className={`text-sm sm:text-lg font-black px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl ${
                        rlt === "passed" ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      }`}
                      animate={percentage >= 90 ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {rlt === "passed" ? 'EXCELLENT' : 'KEEP TRYING'}
                    </motion.p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center mb-4 sm:mb-6">
                  {percentage === 100 && (
                    <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-200 dark:border-amber-800">🎯 Perfect Score</span>
                  )}
                  {attempt.xpEarned && attempt.xpEarned > 150 && (
                    <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">🔥 Elite Performance</span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                  Completed on{' '}
                  {new Date(attempt.completedAt || attempt.updatedAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </motion.div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-neutral-800 pb-2">Detailed Question Review</h3>
              {attempt.questions.map((question: any, index: number) => {
                const userSelectedOptionIndex = attempt.answers[index];
                const isCorrect = userSelectedOptionIndex === question.correctAnswer;
                
                return (
                  <div
                    key={question.id || index}
                    className={`p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border transition-all ${
                      isCorrect
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                        : userSelectedOptionIndex === -1 
                          ? 'bg-slate-50/60 dark:bg-neutral-800/30 border-slate-200 dark:border-neutral-800'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                    }`}
                  >
                    <div className="font-bold mb-4 text-gray-900 dark:text-white flex gap-2.5 sm:gap-3 items-start">
                      <span className={`shrink-0 rounded-lg w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs font-black ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 text-sm sm:text-base leading-snug">
                        <FormattedHeader text={question.question} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {question.options.map((option: string, optionIndex: number) => {
                        const isThisCorrect = optionIndex === question.correctAnswer;
                        const isThisUserSelected = optionIndex === userSelectedOptionIndex;

                        const bgClass = isThisCorrect
                          ? 'bg-white dark:bg-neutral-900 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : isThisUserSelected
                            ? 'bg-white dark:bg-neutral-900 border-rose-500 text-rose-800 dark:text-rose-300'
                            : 'bg-white/60 dark:bg-neutral-900/60 border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400';

                        return (
                          <div
                            key={optionIndex}
                            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex justify-between items-center text-xs sm:text-sm ${bgClass}`}
                          >
                            <span className="flex-1 pr-2">{option}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                               {isThisCorrect && <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">Correct</span>}
                               {isThisUserSelected && !isThisCorrect && <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">Your Choice</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {question.explanation && (
                      <div className="mt-3 sm:mt-4 bg-white/80 dark:bg-neutral-900/80 p-3 sm:p-4 rounded-xl border border-gray-200/80 dark:border-neutral-800">
                        <div className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                          Explanation
                        </div>
                        <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                          {question.explanation}
                        </p>
                      </div>
                    )}

                    {question.proofQuote && (
                      <div className="mt-3 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">
                              Verified from Source
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {question.pageReference && (
                              <span className="bg-white/90 dark:bg-black/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200/50">
                                📄 {question.pageReference}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                              question.citationType === 'LOGICAL_DEDUCTION'
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                                : 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                            }`}>
                              {question.citationType === 'LOGICAL_DEDUCTION' ? '💡 Logical Deduction' : '🛡️ Verbatim Proof'}
                            </span>
                          </div>
                        </div>
                        <blockquote className="text-xs text-emerald-950 dark:text-emerald-100 font-medium italic border-l-2 border-emerald-400 pl-3 leading-relaxed">
                          "{question.proofQuote}"
                        </blockquote>
                      </div>
                    )}
                  </div>
                );
              })}
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