'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flag } from 'lucide-react';

import { LoadingSpinner as Loading } from './LoadingSpinner';
import { FormattedHeader } from './FormattedHeader';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Test {
  id: string;
  title: string;
  duration: number;
  description: string;
  questions: Question[];
  timeLimit?: number; // in minutes
}

interface TestAttemptProps {
  test: Test;
  onComplete: (results: any) => void;
  onQuestionChange?: (index: number) => void;
}

export default function TestAttempt({ test, onComplete, onQuestionChange }: TestAttemptProps) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState((test.timeLimit || test.duration || 30) * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answerIndex,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < test.questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      onQuestionChange?.(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Ensure we have an array of length questions.length, filling with -1 for unanswered
      const answersArray = Array.from({ length: test.questions.length }, (_, i) =>
        answers[i] !== undefined ? answers[i] : -1
      );

      const response = await fetch('/api/tests/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: test.id,
          answers: answersArray,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onComplete(data.attempt);
        toast.success('Test submitted successfully');
      } else {
        throw new Error(data.error || 'Failed to submit test');
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100;

  return (
    <div className="container mx-auto py-8">
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <Loading />
          </motion.div>
        )}
      </AnimatePresence>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-xl p-2 flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain " />
              </div>
              <span className="text-2xl font-black text-gray-900 tracking-tighter">MCQ<span className="text-indigo-600">Test</span></span>
              <CardTitle className="text-xl font-black text-gray-900 truncate">{test.title}</CardTitle>
            </div>
            <div className="text-lg font-semibold">
              Time Left: {formatTime(timeLeft)}
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <div className="text-sm text-gray-400 mt-1 font-bold italic uppercase tracking-widest text-[10px]">
              Question {currentQuestionIndex + 1} of {test.questions.length}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-black text-gray-900 leading-tight">
                  <FormattedHeader text={test.questions[currentQuestionIndex].question} isAttempt={true} />
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                  onClick={async () => {
                    const reason = prompt('What is wrong with this question? (e.g. Typo, Wrong Answer)');
                    if (!reason) return;
                    try {
                      const res = await fetch(`/api/questions/${(test.questions[currentQuestionIndex] as any).id}/audit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason })
                      });
                      if (res.ok) toast.success('Report submitted! Bug Hunter XP awarded (simulated)');
                    } catch (err) {
                      toast.error('Failed to submit report');
                    }
                  }}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report
                </Button>
              </div>
              <RadioGroup
                value={answers[currentQuestionIndex]?.toString() || ""}
                onValueChange={(value) =>
                  handleAnswerSelect(currentQuestionIndex, parseInt(value))
                }
                className="grid grid-cols-1 gap-4"
              >
                {test.questions[currentQuestionIndex].options.map(
                  (option, index) => (
                    <div key={index} className={`flex items-center space-x-4 p-4 rounded-3xl border-2 transition-all cursor-pointer ${answers[currentQuestionIndex] === index ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <RadioGroupItem
                        value={index.toString()}
                        id={`option-${index}`}
                        className="h-6 w-6 border-2"
                      />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-lg font-medium text-gray-700">{option}</Label>
                    </div>
                  )
                )}
              </RadioGroup>
            </div>

            <div className="flex justify-between pt-8 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="h-14 px-8 rounded-2xl font-bold border-2"
              >
                Previous
              </Button>
              {currentQuestionIndex === test.questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="h-14 px-12 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 text-lg"
                >
                  {isSubmitting ? 'SUBMITTING...' : 'COMPLETE TEST'}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="h-14 px-12 rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 text-lg"
                >
                  NEXT QUESTION
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}