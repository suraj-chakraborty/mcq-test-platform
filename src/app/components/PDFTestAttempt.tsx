'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { FormattedHeader } from './FormattedHeader';
import {
  Clock,
  ArrowLeft,
  Grid3X3,
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  AlertTriangle,
  Award,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Question {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  proofQuote?: string;
  pageReference?: string;
  citationType?: 'VERBATIM_PROOF' | 'LOGICAL_DEDUCTION';
}

interface PDFTest {
  id: string;
  title: string;
  description: string;
  timeLimit?: number;
  duration?: number;
  questions: Question[];
}

export default function PDFTestAttempt({ test }: { test: PDFTest }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const answersRef = useRef<{ [key: number]: number }>({});
  answersRef.current = answers;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [visited, setVisited] = useState<Record<number, boolean>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState<{ score: number; percentage: number; totalQuestions?: number }>({
    score: 0,
    percentage: 0,
  });

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const initialDuration = test.duration || test.timeLimit || 15;
  const [timeLeft, setTimeLeft] = useState(initialDuration * 60);

  useEffect(() => {
    setVisited((prev) => ({ ...prev, [currentQuestion]: true }));
  }, [currentQuestion]);

  const handleAnswerChange = useCallback((questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionIndex]: optionIndex };
      answersRef.current = next;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    const answersToSend = test.questions.map((_, index) =>
      answersRef.current[index] !== undefined ? answersRef.current[index] : -1
    );

    try {
      const response = await fetch('/api/pdf-tests/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: test.id,
          answers: answersToSend,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit test');
      }

      setResultData({
        score: data.score,
        percentage: data.percentage,
        totalQuestions: data.totalQuestions || test.questions.length,
      });
      setShowResults(true);

      if (data.percentage >= 70) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#818cf8', '#34d399'],
        });
      }
      toast.success('Test completed successfully!');
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit test');
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  }, [test.id, test.questions]);

  // Global Countdown Timer
  useEffect(() => {
    if (showResults || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, showResults, handleSubmit]);

  const handleNext = () => {
    if (currentQuestion < (test.questions?.length || 1) - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleClearResponse = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion];
      answersRef.current = next;
      return next;
    });
    toast.info('Response cleared for this question');
  };

  const handleToggleMarkForReview = () => {
    setMarkedForReview((prev) => {
      const next = !prev[currentQuestion];
      toast.info(next ? 'Marked for Review' : 'Unmarked from Review');
      return { ...prev, [currentQuestion]: next };
    });
  };

  const currentQObj = test.questions[currentQuestion];
  const { comprehension, mainQuestion } = useMemo(() => {
    if (!currentQObj?.question) return { comprehension: '', mainQuestion: '' };
    const raw = currentQObj.question;

    const match = raw.match(/^(?:Comprehension|Passage|Context)[\s\S]*?(?=\n\n(?:Question|\*\*Question|\bWhich|\bWhat|\bSelect|\bIdentify|\bWho|\bHow|\bWhere|\bIn\b|\bAccording)|\n\n[A-Z0-9])/i);
    if (match) {
      const comp = match[0].trim();
      const rest = raw.slice(comp.length).trim();
      return { comprehension: comp, mainQuestion: rest || raw };
    }

    const doubleNl = raw.indexOf('\n\n');
    if (doubleNl > 120) {
      const comp = raw.slice(0, doubleNl).trim();
      const rest = raw.slice(doubleNl + 2).trim();
      return { comprehension: comp, mainQuestion: rest };
    }

    return { comprehension: '', mainQuestion: raw };
  }, [currentQObj]);

  const stats = useMemo(() => {
    let answered = 0;
    let marked = 0;
    let notAnswered = 0;
    let unattempted = 0;

    test.questions.forEach((_, idx) => {
      const hasAnswer = answers[idx] !== undefined && answers[idx] !== -1;
      const isMarked = !!markedForReview[idx];
      const isVis = !!visited[idx];

      if (isMarked) {
        marked++;
      } else if (hasAnswer) {
        answered++;
      } else if (isVis) {
        notAnswered++;
      } else {
        unattempted++;
      }
    });

    return { answered, unattempted, marked, notAnswered };
  }, [test.questions, answers, markedForReview, visited]);

  const safeTime = Math.max(0, timeLeft);
  const minutes = Math.floor(safeTime / 60);
  const seconds = safeTime % 60;
  const isTimeCritical = minutes < 2;

  // ---------------- RESULTS VIEW ----------------
  if (showResults) {
    const totalQuestions = resultData.totalQuestions || test.questions.length;
    const timeSpent = initialDuration * 60 - safeTime;
    const timeMins = Math.floor(timeSpent / 60);
    const timeSecs = timeSpent % 60;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 py-10 px-4 flex justify-center w-full">
        <div className="w-full max-w-4xl space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-neutral-800 shadow-sm text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" /> Assessment Scorecard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              {test.title}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100">
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{resultData.score}</span>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Score</span>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100">
                <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{resultData.percentage}%</span>
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest block">Accuracy</span>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100">
                <span className="text-2xl font-black text-purple-700 dark:text-purple-400">{totalQuestions}</span>
                <span className="text-[10px] font-bold text-purple-800 uppercase tracking-widest block">Questions</span>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100">
                <span className="text-2xl font-black text-amber-700 dark:text-amber-400">{timeMins}m {timeSecs}s</span>
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Time Taken</span>
              </div>
            </div>

            <Button
              onClick={() => router.push('/dashboard')}
              className="h-10 px-8 bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- LIVE TEST ATTEMPT VIEW ----------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-neutral-950 text-gray-900 dark:text-white select-none">
      {/* 1. TOP HEADER (Responsive & Compact on Mobile) */}
      <header className="bg-slate-900 dark:bg-neutral-900 text-white shadow-md border-b border-slate-800 dark:border-neutral-800 shrink-0 sticky top-0 z-30">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
              title="Exit Test"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-white dark:bg-neutral-800 p-0.5 sm:p-1 flex items-center justify-center shrink-0 shadow-sm">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xs sm:text-sm font-black text-white tracking-tight truncate max-w-[110px] xs:max-w-[170px] sm:max-w-md">
                {test.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-black tracking-wider transition-colors shrink-0 shadow-sm ${
                isTimeCritical
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse'
                  : 'bg-slate-800/90 text-slate-100 border border-slate-700/80'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden h-8 px-2 sm:px-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-[11px]">Palette</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setShowSubmitModal(true)}
              className="h-8 px-3 sm:px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm shrink-0"
            >
              Submit
            </Button>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER: QUESTION STATUS */}
      <div className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-3 sm:px-6 py-2 shrink-0 shadow-xs">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-2 text-xs font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-xs sm:text-sm text-gray-900 dark:text-white shrink-0">
              Question {currentQuestion + 1} <span className="text-gray-400 font-normal text-xs">/ {test.questions.length}</span>
            </span>

            {answers[currentQuestion] !== undefined && answers[currentQuestion] !== -1 ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800 shrink-0">
                Answered
              </span>
            ) : markedForReview[currentQuestion] ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] sm:text-[11px] font-bold border border-amber-200/60 dark:border-amber-800 shrink-0">
                Marked
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] font-bold border border-slate-200 dark:border-neutral-700 shrink-0">
                Not Answered
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleToggleMarkForReview}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs font-bold transition-colors ${
                markedForReview[currentQuestion]
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 border border-transparent'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{markedForReview[currentQuestion] ? 'Marked' : 'Review'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1700px] w-full mx-auto p-2.5 sm:p-5 gap-3 sm:gap-4">
        <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-4 sm:space-y-6">
            <div className={`grid ${comprehension ? 'grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6' : 'grid-cols-1'} items-start`}>
              {comprehension && (
                <div className="space-y-2 sm:space-y-3 lg:border-r lg:border-gray-200 dark:lg:border-neutral-800 lg:pr-6">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Comprehension Passage
                  </span>
                  <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line bg-gray-50/70 dark:bg-neutral-800/40 p-3.5 sm:p-4 rounded-xl border border-gray-200/60 dark:border-neutral-700/60">
                    {comprehension}
                  </div>
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                    <FormattedHeader text={mainQuestion} isAttempt={true} />
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {currentQObj?.options.map((option, optIdx) => {
                    const isSelected = answers[currentQuestion] === optIdx;
                    const optionLetter = String.fromCharCode(65 + optIdx);

                    return (
                      <label
                        key={optIdx}
                        onClick={() => handleAnswerChange(currentQuestion, optIdx)}
                        className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 text-gray-900 dark:text-white shadow-sm ring-1 ring-indigo-600'
                            : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {optionLetter}
                          </div>
                          <span className="text-xs sm:text-sm font-medium leading-normal flex-1">{option}</span>
                        </div>

                        {/* Radio selection circle indicator */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-gray-300 dark:border-neutral-600 bg-transparent'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {currentQObj?.proofQuote && (
                  <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200/80 dark:border-neutral-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{currentQObj.pageReference || 'Document Citation Verified'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="p-3 sm:p-4 bg-gray-50/90 dark:bg-neutral-900/90 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="h-8.5 sm:h-9 px-3 sm:px-4 rounded-lg text-xs font-bold"
              >
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearResponse}
                className="hidden sm:inline-flex h-8.5 sm:h-9 px-3 rounded-lg text-xs font-bold text-gray-600 hover:text-rose-600"
              >
                Clear Response
              </Button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {currentQuestion === test.questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setShowSubmitModal(true)}
                  className="h-8.5 sm:h-9 px-4 sm:px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  Submit Test
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="h-8.5 sm:h-9 px-4 sm:px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  Next Question →
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Question Palette (Desktop) - COMPACT TILES */}
        <div
          className={`hidden lg:flex flex-col bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm transition-all duration-300 ${
            sidebarCollapsed ? 'w-10 overflow-hidden p-1' : 'w-72 shrink-0 p-4'
          }`}
        >
          {sidebarCollapsed ? (
            <div className="h-full flex flex-col items-center justify-center">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                title="Expand Question Palette"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-3.5 overflow-y-auto">
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <Grid3X3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Question Palette
                  </h4>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Collapse Palette"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Summary Cards */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Answered</span>
                  <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shadow-sm">
                    {stats.answered}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700/60">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Unvisited</span>
                  <span className="w-5 h-5 rounded-md bg-white dark:bg-neutral-700 border border-slate-300 text-slate-800 dark:text-slate-200 font-black text-[10px] flex items-center justify-center shadow-sm">
                    {stats.unattempted}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300">Skipped</span>
                  <span className="w-5 h-5 rounded-md bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shadow-sm">
                    {stats.notAnswered}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Review</span>
                  <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shadow-sm">
                    {stats.marked}
                  </span>
                </div>
              </div>

              {/* 5-Column Question Grid - COMPACT TILES */}
              <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {test.questions.map((_, qIdx) => {
                    const isCurrent = currentQuestion === qIdx;
                    const hasAnswer = answers[qIdx] !== undefined && answers[qIdx] !== -1;
                    const isMarked = !!markedForReview[qIdx];
                    const isVis = !!visited[qIdx];

                    let colorClasses = 'bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:border-slate-400 hover:bg-slate-100';
                    if (isMarked) {
                      colorClasses = 'bg-amber-500 text-white border-amber-600 shadow-sm';
                    } else if (hasAnswer) {
                      colorClasses = 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
                    } else if (isVis) {
                      colorClasses = 'bg-rose-600 text-white border-rose-700 shadow-sm';
                    }

                    return (
                      <button
                        key={qIdx}
                        onClick={() => setCurrentQuestion(qIdx)}
                        className={`w-8 h-8 rounded-lg font-black text-[11px] flex items-center justify-center transition-all ${colorClasses} ${
                          isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-neutral-900 scale-105 z-10 shadow-md font-black' : 'hover:scale-[1.04]'
                        }`}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. MOBILE QUESTION PALETTE SHEET - COMPACT TILES */}
      <AnimatePresence>
        {mobilePaletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobilePaletteOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 z-50 w-[80%] max-w-xs bg-white dark:bg-neutral-900 p-4 shadow-2xl overflow-y-auto flex flex-col justify-between lg:hidden"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <Grid3X3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                      Question Palette ({test.questions.length})
                    </h4>
                  </div>
                  <button
                    onClick={() => setMobilePaletteOpen(false)}
                    className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Answered</span>
                    <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                      {stats.answered}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700/60">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Unvisited</span>
                    <span className="w-5 h-5 rounded-md bg-white dark:bg-neutral-700 border border-slate-300 text-slate-800 dark:text-slate-200 font-black text-[10px] flex items-center justify-center">
                      {stats.unattempted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                    <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300">Skipped</span>
                    <span className="w-5 h-5 rounded-md bg-rose-600 text-white font-black text-[10px] flex items-center justify-center">
                      {stats.notAnswered}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Review</span>
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[10px] flex items-center justify-center">
                      {stats.marked}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 justify-items-center pt-2">
                  {test.questions.map((_, qIdx) => {
                    const isCurrent = currentQuestion === qIdx;
                    const hasAnswer = answers[qIdx] !== undefined && answers[qIdx] !== -1;
                    const isMarked = !!markedForReview[qIdx];
                    const isVis = !!visited[qIdx];

                    let colorClasses = 'bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300';
                    if (isMarked) {
                      colorClasses = 'bg-amber-500 text-white border-amber-600';
                    } else if (hasAnswer) {
                      colorClasses = 'bg-emerald-600 text-white border-emerald-700';
                    } else if (isVis) {
                      colorClasses = 'bg-rose-600 text-white border-rose-700';
                    }

                    return (
                      <button
                        key={qIdx}
                        onClick={() => {
                          setCurrentQuestion(qIdx);
                          setMobilePaletteOpen(false);
                        }}
                        className={`w-8 h-8 rounded-lg font-black text-[11px] flex items-center justify-center ${colorClasses} ${
                          isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                        }`}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-neutral-800">
                <Button
                  onClick={() => {
                    setMobilePaletteOpen(false);
                    setShowSubmitModal(true);
                  }}
                  className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-sm"
                >
                  Submit Assessment
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 5. SUBMIT CONFIRMATION MODAL */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="max-w-md rounded-xl p-6 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-900 dark:text-white">
              Submit Assessment?
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Review your attempt status before completing:
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3 text-xs font-bold">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 text-emerald-800 dark:text-emerald-200">
              <span className="text-lg block font-black">{stats.answered}</span>
              <span>Answered</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-100 text-rose-800 dark:text-rose-200">
              <span className="text-lg block font-black">{stats.notAnswered + stats.unattempted}</span>
              <span>Unattempted / Skipped</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitModal(false)}
              className="h-10 rounded-lg text-xs font-bold"
            >
              Resume Test
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider"
            >
              {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. REPORT MODAL */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-md rounded-xl p-6 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-gray-900 dark:text-white">
              Report Question #{currentQuestion + 1}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Flag any errors found in this question.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Our audit system will review this question and verify its source citations.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setShowReportModal(false)}
              className="h-9 rounded-lg text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowReportModal(false);
                toast.success('Report submitted for review');
              }}
              className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}