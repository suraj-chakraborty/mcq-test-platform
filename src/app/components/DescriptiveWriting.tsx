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
import { Mic, MicOff, Sparkles } from 'lucide-react';
import OralExam from './OralExam';

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
  const [isOralExamOpen, setIsOralExamOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const autoSaveRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setAnswer((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + event.results[i][0].transcript);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        console.log('Interim:', interimTranscript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error('Speech recognition not supported in this browser');
        return;
      }
      recognitionRef.current.start();
      setIsListening(true);
      toast.success('Listening... speak your answer.');
    }
  };

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Descriptive Writing Practice</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2 border-indigo-200 text-indigo-600 font-bold"
            onClick={() => setIsOralExamOpen(true)}
            disabled={isTestActive}
          >
            <Sparkles className="h-4 w-4" />
            Try Oral Exam
          </Button>
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
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium">Your Answer</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-full gap-2 ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-indigo-600 hover:bg-indigo-50'}`}
                    onClick={toggleListening}
                    disabled={isSubmitting}
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {isListening ? 'Stop Listening' : 'Speak Answer'}
                  </Button>
                </div>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write or speak your answer here..."
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
      
      {isOralExamOpen && (
        <OralExam 
          question={question || "Explain the concept you are practicing."} 
          onClose={() => setIsOralExamOpen(false)} 
        />
      )}
    </div>
  );
} 