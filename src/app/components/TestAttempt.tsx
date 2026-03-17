'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flag } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Test {
  id: string;
  title: string;
  duration: number;
  description: string;
  questions: Question[];
  timeLimit: number; // in minutes
}

interface TestAttemptProps {
  test: Test;
  onComplete: (results: any) => void;
  onQuestionChange?: (index: number) => void;
}

export default function TestAttempt({ test, onComplete, onQuestionChange }: TestAttemptProps) {
  // console.log("testAttempt 😊", test)
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(test.timeLimit * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // console.log("test", test)
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

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
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
      const response = await fetch('/api/tests/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: test.id,
          answers: Object.values(answers),
        }),
      });

      const data = await response.json();
      if (data.success) {
        onComplete(data.data);
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{test.title}</CardTitle>
            <div className="text-lg font-semibold">
              Time Left: {formatTime(timeLeft)}
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <div className="text-sm text-gray-500 mt-1">
              Question {currentQuestionIndex + 1} of {test.questions.length}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium">
                  {test.questions[currentQuestionIndex].question}
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50"
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
                  <Flag className="h-4 w-4 mr-1" />
                  Report
                </Button>
              </div>
              <RadioGroup
                value={answers[currentQuestionIndex] || ''}
                onValueChange={(value) =>
                  handleAnswerSelect(currentQuestionIndex, value)
                }
              >
                {test.questions[currentQuestionIndex].options.map(
                  (option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={option}
                        id={`option-${index}`}
                      />
                      <Label htmlFor={`option-${index}`}>{option}</Label>
                    </div>
                  )
                )}
              </RadioGroup>
            </div>

            <div className="flex justify-between">
              <Button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              {currentQuestionIndex === test.questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Test'}
                </Button>
              ) : (
                <Button onClick={handleNext}>Next</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 