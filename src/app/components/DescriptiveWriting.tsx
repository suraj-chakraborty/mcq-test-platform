'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner as Loading } from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  PenTool,
  Clock,
  BookOpen,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Shuffle,
  FileText,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
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

const EXAM_PRESETS = [
  { label: 'UPSC Mains GS', name: 'UPSC Civil Services - GS Paper', time: 15 },
  { label: 'IELTS Task 2', name: 'IELTS Academic Writing - Task 2', time: 40 },
  { label: 'GRE Issue Essay', name: 'GRE Analytical Writing - Issue Task', time: 30 },
  { label: 'State PSC', name: 'State Public Service Commission', time: 20 },
  { label: 'Editorial Essay', name: 'Current Affairs Analytical Essay', time: 25 },
];

const SAMPLE_PROMPTS = [
  "Critically examine the socio-economic and geopolitical implications of transitioning towards green energy in emerging market economies.",
  "Artificial Intelligence and automation are rapidly reshaping the global workforce. Discuss the regulatory challenges and ethical frameworks necessary to safeguard employment.",
  "Evaluate the balance between national security surveillance and individual fundamental rights to privacy in the digital age.",
  "Climate change impacts developing nations disproportionately despite lower historical emissions. Analyze the principles of common but differentiated responsibilities (CBDR).",
  "Analyze the role of digital public infrastructure (DPI) in fostering inclusive economic growth and financial empowerment."
];

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.success('Microphone active. Speak your answer clearly.');
      } catch (err) {
        console.error(err);
      }
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
          timeLeft,
        };
        localStorage.setItem('descriptiveWritingState', JSON.stringify(state));
        setAutoSaveStatus('Draft saved');
        setTimeout(() => setAutoSaveStatus(''), 2500);
      }, 30000);
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
        if (state.answer && state.timeLeft > 0) {
          setIsTestActive(true);
          toast.info('Restored your ongoing writing session.');
        }
      } catch (err) {
        console.error('Error loading saved state:', err);
      }
    }
  }, []);

  // Timer functionality
  useEffect(() => {
    if (!isTestActive) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTestActive]);

  // Word count tracking
  useEffect(() => {
    const words = answer.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
  }, [answer]);

  const handleSelectPreset = (preset: typeof EXAM_PRESETS[0]) => {
    setExamName(preset.name);
    setTimeLimit(preset.time);
    setTimeLeft(preset.time * 60);
    setError(null);
  };

  const handleLoadSamplePrompt = () => {
    const remaining = SAMPLE_PROMPTS.filter((p) => p !== question);
    const randomPrompt = remaining[Math.floor(Math.random() * remaining.length)] || SAMPLE_PROMPTS[0];
    setQuestion(randomPrompt);
    if (!examName) {
      setExamName('UPSC Civil Services - GS Paper');
      setTimeLimit(15);
    }
    setError(null);
  };

  const startTest = () => {
    if (!examName.trim() || !question.trim()) {
      setError('Please provide both the Exam Name and Question prompt.');
      return;
    }
    if (timeLimit < 1 || timeLimit > 180) {
      setError('Time limit must be between 1 and 180 minutes.');
      return;
    }
    setError(null);
    setIsTestActive(true);
    setTimeLeft(timeLimit * 60);
  };

  const handleCancelTest = () => {
    setShowCancelConfirm(false);
    setIsTestActive(false);
    setAnswer('');
    setWordCount(0);
    setTimeLeft(timeLimit * 60);
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    localStorage.removeItem('descriptiveWritingState');
    toast.info('Writing practice session cancelled.');
  };

  const handleSubmit = async () => {
    if (!isTestActive) return;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    if (!answer.trim()) {
      setError('Cannot submit an empty answer. Please write or dictate your response.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/descriptive/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examName,
          question,
          answer,
          wordCount,
          timeLimit,
          timeTaken: Math.max(1, timeLimit * 60 - timeLeft),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate answer');
      }

      const data = await response.json();
      if (data.success) {
        setEvaluationResult(data.test);
        setShowResults(true);
        toast.success('Answer evaluated successfully! Review your score.');
        localStorage.removeItem('descriptiveWritingState');
      } else {
        throw new Error(data.error || 'Evaluation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate answer');
      toast.error('Evaluation failed. Please try again.');
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

  const progressPercentage = Math.min(100, Math.max(0, (timeLeft / (timeLimit * 60)) * 100));
  const isTimeCritical = timeLeft < 300; // less than 5 minutes

  return (
    <div className="w-full space-y-6">
      {/* Loading Overlay */}
      <AnimatePresence>
        {(isSubmitting || isLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
          >
            <Loading />
            <p className="mt-4 text-sm font-semibold text-white">Analyzing your answer against official rubrics...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-rose-500/50 bg-rose-500/10 text-rose-200">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
        </Alert>
      )}

      {/* VIEW 1: PRE-TEST CONFIGURATION (Setup Studio) */}
      {!isTestActive ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Main Practice Setup Card (2 Columns) */}
          <div className="lg:col-span-2 bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800/90 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
            {/* Quick Presets Bar */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 mb-2">
                Quick Exam Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAM_PRESETS.map((p) => {
                  const isSelected = examName === p.name;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20'
                          : 'bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-500/40'
                      }`}
                    >
                      {p.label} <span className="opacity-60 text-[10px]">({p.time}m)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Exam Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300">
                Exam Name & Section
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. UPSC Mains GS Paper 2, IELTS Task 2, GRE Issue Essay"
                  disabled={isLoading}
                  className="pl-10 h-11 rounded-xl bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-sm focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Question Prompt Textarea with Sample Generator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300">
                  Question / Essay Topic
                </label>
                <button
                  type="button"
                  onClick={handleLoadSamplePrompt}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Load Sample Prompt</span>
                </button>
              </div>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter or paste the essay question, thesis statement, or prompt to answer..."
                rows={4}
                disabled={isLoading}
                className="rounded-xl bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-sm leading-relaxed p-3.5 focus:border-indigo-500 resize-y min-h-[110px]"
              />
            </div>

            {/* Time Limit Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300">
                  Time Limit (Minutes)
                </label>
                <div className="flex items-center gap-1">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTimeLimit(mins)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition ${
                        timeLimit === mins
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700'
                          : 'bg-transparent text-gray-500 dark:text-neutral-400 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={180}
                  disabled={isLoading}
                  className="pl-10 h-11 rounded-xl bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-sm focus:border-indigo-500 max-w-xs"
                />
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={startTest}
              className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              disabled={isLoading}
            >
              <PenTool className="w-4 h-4" />
              <span>Start Writing Session</span>
            </Button>
          </div>

          {/* Side Feature & Guidance Panel (1 Column) */}
          <div className="space-y-4">
            {/* Interactive Oral Defense Card */}
            <div className="bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800/90 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Oral Defense Mode</h3>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400">Verbal viva & interview defense</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                Prefer speaking your thoughts? Defend your arguments verbally with real-time speech evaluation.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOralExamOpen(true)}
                className="w-full rounded-xl border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-800 dark:text-neutral-200 font-semibold text-xs h-9 gap-1.5 transition-all"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Launch Oral Exam</span>
              </Button>
            </div>

            {/* Evaluation Rubric Breakdown */}
            <div className="bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800/90 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-neutral-300">
                  Evaluation Rubric
                </h3>
                <span className="text-[10px] font-bold text-neutral-400">3 Criteria</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5 text-gray-600 dark:text-neutral-300">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/60 mt-0.5 shrink-0">
                    01
                  </span>
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">Structure & Thesis:</span> Clear introduction, structured arguments, and decisive conclusion.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-gray-600 dark:text-neutral-300">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/60 mt-0.5 shrink-0">
                    02
                  </span>
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">Critical Depth:</span> Evidence, counter-perspectives, and analytical reasoning.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-gray-600 dark:text-neutral-300">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/60 mt-0.5 shrink-0">
                    03
                  </span>
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">Vocabulary & Tone:</span> Lexical precision, academic register, and syntactic fluency.
                  </div>
                </div>
              </div>
            </div>

            {/* Dictation Tip */}
            <div className="bg-gray-50/70 dark:bg-neutral-900/60 border border-gray-200 dark:border-neutral-800 rounded-xl p-3.5 flex items-center gap-2.5">
              <Mic className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-gray-600 dark:text-neutral-400 leading-snug">
                Speech dictation is available during the writing test. Speak answers freely.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: ACTIVE WRITING SESSION */
        <div className="space-y-4">
          {/* Top Floating HUD Bar */}
          <div className="bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40">
                  {examName}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-1 leading-snug">
                  {question}
                </h3>
              </div>

              {/* HUD Stats & Voice Dictation Toggle */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                {/* Timer Badge */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all ${
                    isTimeCritical
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 animate-pulse'
                      : 'bg-gray-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200 border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTime(timeLeft)}</span>
                </div>

                {/* Word Count Badge */}
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-900 text-xs font-bold text-gray-700 dark:text-neutral-300">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{wordCount} words</span>
                </div>

                {/* Speech Dictation Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleListening}
                  disabled={isSubmitting}
                  className={`rounded-xl text-xs font-bold h-8 px-3 gap-1.5 transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white border-rose-500 animate-pulse hover:bg-rose-600'
                      : 'border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                  }`}
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice Dictate'}</span>
                </Button>
              </div>
            </div>

            {/* Time Progress Bar */}
            <div className="space-y-1">
              <Progress
                value={progressPercentage}
                className={`h-1.5 rounded-full ${isTimeCritical ? '[&>div]:bg-rose-500' : '[&>div]:bg-indigo-600'}`}
              />
              <div className="flex justify-between items-center text-[10px] text-gray-400">
                <span>{autoSaveStatus || 'Autosave enabled (every 30s)'}</span>
                <span>{Math.round(progressPercentage)}% time left</span>
              </div>
            </div>
          </div>

          {/* Writing Canvas Textarea */}
          <div className="bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              Your Written Answer
            </label>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Begin typing or speak your response here. Structure into introduction, body arguments, and conclusion..."
              className="w-full min-h-[360px] sm:min-h-[440px] rounded-xl p-4 text-sm sm:text-base leading-relaxed bg-gray-50/70 dark:bg-[#0c0d10] border-gray-200 dark:border-neutral-800/90 text-gray-900 dark:text-neutral-100 focus:border-indigo-500 resize-y font-normal"
              disabled={isSubmitting}
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCancelConfirm(true)}
              disabled={isSubmitting}
              className="text-xs font-bold text-gray-500 hover:text-rose-600 dark:hover:text-rose-400"
            >
              Cancel Session
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !answer.trim()}
              className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit for Evaluation</span>
            </Button>
          </div>
        </div>
      )}

      {/* EVALUATION RESULTS MODAL */}
      <Dialog open={showResults} onOpenChange={handleCloseResults}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-indigo-500" />
              <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
                Evaluation Report
              </DialogTitle>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {examName} • {wordCount} words written
            </p>
          </DialogHeader>

          {evaluationResult && (
            <div className="space-y-5 pt-3">
              {/* Score Header Card */}
              <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Overall Score</span>
                  <div className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">
                    {evaluationResult.score} <span className="text-base font-normal text-gray-400">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">Time Taken</span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                    {formatTime(timeLimit * 60 - timeLeft)}
                  </p>
                </div>
              </div>

              {/* Feedback */}
              <div className="bg-gray-50 dark:bg-neutral-900/80 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  Executive Summary
                </h4>
                <p className="text-sm text-gray-800 dark:text-neutral-200 leading-relaxed">
                  {evaluationResult.feedback}
                </p>
              </div>

              {/* Strengths */}
              {evaluationResult.strengths?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Key Strengths
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-700 dark:text-neutral-300">
                    {evaluationResult.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to Improve */}
              {evaluationResult.areasToImprove?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Areas to Improve
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-700 dark:text-neutral-300">
                    {evaluationResult.areasToImprove.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-2.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {evaluationResult.suggestions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Recommendations & Action Items
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-700 dark:text-neutral-300">
                    {evaluationResult.suggestions.map((sug, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-2.5">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleCloseResults}
                  className="rounded-xl font-bold text-xs h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Done & Close Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CANCEL CONFIRMATION DIALOG */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="bg-white dark:bg-[#121316] border border-gray-200 dark:border-neutral-800 rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              Cancel Writing Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500 dark:text-neutral-400">
              Are you sure you want to stop this practice session? Your current draft and timer progress will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">Keep Writing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelTest}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Yes, Cancel Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ORAL EXAM MODAL */}
      {isOralExamOpen && (
        <OralExam
          question={question || "Explain the core argument or thesis statement you want to present."}
          onClose={() => setIsOralExamOpen(false)}
        />
      )}
    </div>
  );
}