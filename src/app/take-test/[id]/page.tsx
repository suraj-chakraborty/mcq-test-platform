'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Test {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  totalMarks: number;
  passingMarks: number;
  duration: number;
  createdAt: string;
}

export default function TakeTestPage() {
  const router = useRouter();
  const params = useParams()
  const { data: session, status } = useSession();
  const [tests, setTests] = useState<Test | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tests/${params.id}/start`);
        const data = await response.json();

        if (!response.ok || !data.test) {
          throw new Error(data.error || 'Failed to fetch test');
        }

        const test = data.test as Test;
        setTests(test);
        setTimeLeft(test.duration * 60);
        setAnswers(new Array(test.questions.length).fill(-1));
      } catch (err) {
        console.error('Error fetching test:', err);
        toast.error('Failed to load test');
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchTest();
    }
  }, [session, params.id, router]);

  useEffect(() => {
    if (timeLeft > 0) {
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
    }
  }, [timeLeft]);

  const handleAnswerSelect = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = parseInt(value);
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < (tests?.questions.length || 0) - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!tests) return;

    try {
      const response = await fetch(`/api/tests/${tests.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: tests.id, answers, questions: tests.questions }),
      });

      const data = await response.json();
      console.log("take testdata", data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit test');
      }

      if (data.attemptId) {
        router.push(`/test-results/${data.attemptId}`);
      } else {
        toast.error('Failed to get test results ID');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error('Failed to submit test. Please try again.');
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  if (!tests || tests.questions.length === 0 || answers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Test Not Found or Invalid</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / tests.questions.length) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{tests.title}</span>
            <span className="text-lg font-semibold">
              Time Left: {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-6" />

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">
              Question {currentQuestion + 1} of {tests.questions.length}
            </h3>
            <p className="text-xl mb-4">{tests.questions[currentQuestion].question}</p>

            <RadioGroup
              value={answers[currentQuestion]?.toString() ?? ''}
              onValueChange={handleAnswerSelect}
              className="space-y-4"
            >
              {tests.questions[currentQuestion].options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            {currentQuestion === tests.questions.length - 1 ? (
              <Button onClick={handleSubmit}>Submit Test</Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
