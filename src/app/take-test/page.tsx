'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Test {
  id: string;
  title: string;
  duration: number; // in minutes
  questions: Question[];
}

export default function TakeTest() {
  const router = useRouter();
  const { data: session } = useSession();
  const [test, setTest] = useState<Test | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useEffect(() => {
    // TODO: Fetch test data from API
    // For now, using mock data
  //   const mockTest: Test = {
  //     id: '1',
  //     title: 'Sample Test',
  //     duration: 30,
  //     questions: [
  //       {
  //         id: '1',
  //         question: 'What is the capital of France?',
  //         options: ['London', 'Berlin', 'Paris', 'Madrid'],
  //         correctAnswer: 2,
  //       },
  //       // Add more questions...
  //     ],
  //   };
  //   setTest(mockTest);
  //   setTimeLeft(mockTest.duration * 60);
  //   setAnswers(new Array(mockTest.questions.length).fill(-1));
  // }, []);

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
    if (currentQuestion < (test?.questions.length || 0) - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!test) return;
    
    setIsSubmitting(true);
    try {
      // TODO: Submit answers to API
      const score = answers.reduce((acc, answer, index) => {
        return acc + (answer === test.questions[index].correctAnswer ? 1 : 0);
      }, 0);

      toast.success(`Test completed! Score: ${score}/${test.questions.length}`);
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!test) {
    return <div>Loading...</div>;
  }

  const progress = ((currentQuestion + 1) / test.questions.length) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{test.title}</span>
            <span className="text-lg font-semibold">
              Time Left: {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-6" />
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">
              Question {currentQuestion + 1} of {test.questions.length}
            </h3>
            <p className="text-xl mb-4">{test.questions[currentQuestion].question}</p>
            
            <RadioGroup
              value={answers[currentQuestion].toString()}
              onValueChange={handleAnswerSelect}
              className="space-y-4"
            >
              {test.questions[currentQuestion].options.map((option, index) => (
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
            {currentQuestion === test.questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                Submit Test
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 