'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PDFTest {
  _id: string;
  title: string;
  description: string;
  timeLimit: number;
  questions: Question[];
}

interface TestAttempt {
  testId: string;
  answers: { [key: number]: string };
  score: number;
  timeTaken: number;
}

export default function PDFTestAttempt({ test }: { test: PDFTest }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [timeLeft, setTimeLeft] = useState(test.timeLimit * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

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

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/pdf-tests/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: test._id,
          answers,
          timeTaken: test.timeLimit * 60 - timeLeft,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setScore(data.score);
        setShowResults(true);
        toast.success('Test submitted successfully');
      }
    } catch (error) {
      toast.error('Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (showResults) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Your Score: {score}%</h2>
            <div className="space-y-4">
              {test.questions.map((question, index) => (
                <div key={index} className="border rounded p-4">
                  <p className="font-medium">{question.question}</p>
                  <div className="mt-2">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-2 rounded ${
                          option === question.correctAnswer
                            ? 'bg-green-100'
                            : answers[index] === option
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Explanation: {question.explanation}
                  </p>
                </div>
              ))}
            </div>
            <Button
              className="mt-4"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{test.title}</CardTitle>
          <div className="text-lg font-semibold">
            Time Left: {formatTime(timeLeft)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {test.questions.map((question, index) => (
            <div key={index} className="space-y-2">
              <p className="font-medium">{question.question}</p>
              <RadioGroup
                value={answers[index] || ''}
                onValueChange={(value) => handleAnswerChange(index, value)}
              >
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={option}
                      id={`q${index}-o${optIndex}`}
                    />
                    <Label htmlFor={`q${index}-o${optIndex}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 