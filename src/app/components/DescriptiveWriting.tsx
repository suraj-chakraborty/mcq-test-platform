'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from './LoadingSpinner';

interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  areasToImprove: string[];
  suggestions: string[];
}

interface SavedState {
  examName: string;
  question: string;
  answer: string;
  timeLimit: number;
  timeLeft: number;
}

export default function DescriptiveWriting() {
  const [examName, setExamName] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [timeLimit, setTimeLimit] = useState(30);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestActive, setIsTestActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout>();
  const autoSaveRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality
  useEffect(() => {
    if (isTestActive) {
      autoSaveRef.current = setInterval(() => {
        const state: SavedState = {
          examName,
          question,
          answer,
          timeLimit,
          timeLeft
        };
        localStorage.setItem('descriptiveWritingState', JSON.stringify(state));
        setAutoSaveStatus('Auto-saved');
        setTimeout(() => setAutoSaveStatus(''), 2000);
      }, 30000); // Auto-save every 30 seconds
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [isTestActive, examName, question, answer, timeLimit, timeLeft]);

  // Load saved state on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('descriptiveWritingState');
    if (savedState) {
      try {
        const state: SavedState = JSON.parse(savedState);
        setExamName(state.examName);
        setQuestion(state.question);
        setAnswer(state.answer);
        setTimeLimit(state.timeLimit);
        setTimeLeft(state.timeLeft);
        if (state.answer) {
          setIsTestActive(true);
        }
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    }
  }, []);

  // Timer functionality
  useEffect(() => {
    if (isTestActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleSubmit();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTestActive, timeLeft]);

  // Word count tracking
  useEffect(() => {
    const words = answer.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [answer]);

  const startTest = () => {
    if (!examName || !question) {
      setError('Please enter exam name and question');
      return;
    }
    if (timeLimit < 1 || timeLimit > 120) {
      setError('Time limit must be between 1 and 120 minutes');
      return;
    }
    setError(null);
    setIsTestActive(true);
    setTimeLeft(timeLimit * 60);
  };

  const handleSubmit = async () => {
    if (!isTestActive) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/descriptive/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examName,
          question,
          answer,
          wordCount,
          timeLimit,
          timeTaken: timeLimit * 60 - timeLeft,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate answer');
      }

      const data = await response.json();
      if (data.success) {
        setEvaluationResult(data.test);
        setShowResults(true);
        toast.success('Answer evaluated successfully!');
        // Clear saved state after successful submission
        localStorage.removeItem('descriptiveWritingState');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to evaluate answer');
      toast.error('Failed to evaluate answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setAnswer('');
    setWordCount(0);
    setIsTestActive(false);
    localStorage.removeItem('descriptiveWritingState');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (timeLeft / (timeLimit * 60)) * 100;

  return (
    <div className="min-h-screen p-4">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Descriptive Writing Practice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isTestActive ? (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Exam Name</label>
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g., UPSC, IELTS"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Question</label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your question here..."
                  rows={3}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Time Limit (minutes)</label>
                <Input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  min={1}
                  max={120}
                  disabled={isLoading}
                />
              </div>
              <Button 
                onClick={startTest} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : 'Start Test'}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                <div className="text-lg font-semibold">
                  Time Left: {formatTime(timeLeft)}
                </div>
                <div className="text-lg font-semibold">
                  Words: {wordCount}
                </div>
                {autoSaveStatus && (
                  <div className="text-sm text-gray-500">
                    {autoSaveStatus}
                  </div>
                )}
              </div>

              <Progress value={progressPercentage} className="mb-4" />

              <div className="space-y-2">
                <label className="block text-sm font-medium">Question</label>
                <p className="text-lg">{question}</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Your Answer</label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your answer here..."
                  rows={10}
                  className="min-h-[300px]"
                  disabled={isSubmitting}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={handleCloseResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evaluation Results</DialogTitle>
          </DialogHeader>
          {evaluationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Score</h3>
                  <p className="text-2xl font-bold">{evaluationResult.score}/100</p>
                </div>
                <div>
                  <h3 className="font-semibold">Word Count</h3>
                  <p className="text-2xl font-bold">{wordCount}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold">Feedback</h3>
                <p className="mt-1">{evaluationResult.feedback}</p>
              </div>

              <div>
                <h3 className="font-semibold">Strengths</h3>
                <ul className="list-disc list-inside mt-1">
                  {evaluationResult.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold">Areas to Improve</h3>
                <ul className="list-disc list-inside mt-1">
                  {evaluationResult.areasToImprove.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold">Suggestions</h3>
                <ul className="list-disc list-inside mt-1">
                  {evaluationResult.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={handleCloseResults}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 