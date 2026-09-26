'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Hourglass,
  ShieldCheck,
  Zap,
  Layers,
  BookOpen
} from 'lucide-react';

export interface TestCreationProgressModalProps {
  isOpen: boolean;
  uploadProgress?: number; // 0 - 100 from Cloudinary direct upload
  numQuestions?: number;
  fileCount?: number;
  testTitle?: string;
  isComplete?: boolean;
}

interface StepInfo {
  id: number;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STEPS: StepInfo[] = [
  {
    id: 1,
    title: 'Cloud Document Ingestion',
    detail: 'Uploading bytes & validating document structure...',
    icon: UploadCloud,
  },
  {
    id: 2,
    title: 'Layout & Deep Text Extraction',
    detail: 'Parsing chapters, diagrams, formulas & tables...',
    icon: FileText,
  },
  {
    id: 3,
    title: 'Domain & Topic Archetype Analysis',
    detail: 'Mapping key themes & high-yield syllabus concepts...',
    icon: BookOpen,
  },
  {
    id: 4,
    title: 'High-Yield MCQ Formulation',
    detail: 'Drafting questions with Bloom\'s taxonomy & plausible distractors...',
    icon: Brain,
  },
  {
    id: 5,
    title: 'Source Proofs & Anti-Hallucination Audit',
    detail: 'Cross-verifying every answer against exact document citations...',
    icon: ShieldCheck,
  },
];

const DID_YOU_KNOW_TIPS = [
  {
    icon: '🧠',
    title: 'Active Recall',
    tip: 'Testing yourself is proven to boost long-term retention by up to 150% compared to passive re-reading.',
  },
  {
    icon: '⚡',
    title: 'Anti-Hallucination Grounding',
    tip: 'Our engine extracts direct quotes and page references from your PDF to verify every generated answer.',
  },
  {
    icon: '🎯',
    title: 'Cognitive Distractors',
    tip: 'Each incorrect option is crafted to identify common conceptual misconceptions rather than obvious false answers.',
  },
  {
    icon: '📈',
    title: 'Spaced Repetition Ready',
    tip: 'Once created, this test connects to your adaptive flashcard deck to schedule reviews right before memory decay.',
  },
  {
    icon: '🔬',
    title: 'Arbitrary Document Scaling',
    tip: 'Our pipeline seamlessly processes lecture notes, full textbooks, and multi-column research papers.',
  },
  {
    icon: '💡',
    title: 'Study Tip',
    tip: 'Taking short 5-minute quizzes immediately after reading increases syllabus comprehension by over 40%.',
  },
];

export function TestCreationProgressModal({
  isOpen,
  uploadProgress = 0,
  numQuestions = 10,
  fileCount = 1,
  testTitle = 'Interactive Test',
  isComplete = false,
}: TestCreationProgressModalProps) {
  // Estimated total time in seconds:
  // Base upload/extraction: ~8s + ~1.8s per question + ~3s per extra file
  const estimatedTotalSeconds = useMemo(() => {
    const base = 12;
    const perQ = Math.max(1, numQuestions) * 1.6;
    const perFile = Math.max(0, fileCount - 1) * 3;
    return Math.min(65, Math.max(18, Math.round(base + perQ + perFile)));
  }, [numQuestions, fileCount]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Timer loop
  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  // Engaging tips rotator loop
  useEffect(() => {
    if (!isOpen) return;

    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % DID_YOU_KNOW_TIPS.length);
    }, 4500);

    return () => clearInterval(tipTimer);
  }, [isOpen]);

  // Calculate smooth progress percentage
  const currentProgress = useMemo(() => {
    if (isComplete) return 100;

    // Phase 1: Upload (0% - 25%)
    if (uploadProgress < 100) {
      return Math.min(25, Math.round((uploadProgress / 100) * 25));
    }

    // Phase 2-5: Server Processing & AI Generation (25% - 95%)
    // Compute progress based on elapsed time vs estimated total time with asymptotic decay
    const remainingEstimated = Math.max(1, estimatedTotalSeconds);
    const progressRatio = elapsedSeconds / remainingEstimated;

    if (progressRatio <= 1.0) {
      // Linear ramp up to 88%
      const baseRange = 88 - 25;
      return Math.min(88, Math.round(25 + progressRatio * baseRange));
    } else {
      // Overtime: Asymptotic easing towards 96% so progress NEVER freezes
      const overtimeSeconds = elapsedSeconds - remainingEstimated;
      const asymptoticBonus = 8 * (1 - Math.exp(-overtimeSeconds / 15));
      return Math.min(96, Math.round(88 + asymptoticBonus));
    }
  }, [isComplete, uploadProgress, elapsedSeconds, estimatedTotalSeconds]);

  // Active step index (0-4)
  const activeStepIndex = useMemo(() => {
    if (isComplete || currentProgress >= 98) return 4;
    if (currentProgress < 25) return 0;
    if (currentProgress < 48) return 1;
    if (currentProgress < 68) return 2;
    if (currentProgress < 86) return 3;
    return 4;
  }, [currentProgress, isComplete]);

  // Estimated seconds remaining
  const remainingSeconds = useMemo(() => {
    if (isComplete) return 0;
    const remaining = estimatedTotalSeconds - elapsedSeconds;
    return Math.max(0, remaining);
  }, [estimatedTotalSeconds, elapsedSeconds, isComplete]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="test-creation-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/85 backdrop-blur-xl"
      >
        <motion.div
          key="test-creation-modal"
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 12, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-2xl sm:rounded-3xl bg-[#0f1015] border border-neutral-800 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.8)] p-5 sm:p-6 space-y-4 overflow-hidden"
        >
          {/* Centered Logo & Header */}
          <div className="text-center space-y-2 pt-0.5">
            <div className="flex justify-center">
              <div className="relative group">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-neutral-900 border border-neutral-800 p-2.5 flex items-center justify-center shadow-lg shadow-black/40">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-indigo-500/10 blur-md pointer-events-none -z-10 animate-pulse" />
              </div>
            </div>

            <div className="space-y-0.5">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Synthesizing Your Test
              </h2>
              <p className="text-xs text-neutral-400 font-medium line-clamp-1">
                {`${testTitle ? `"${testTitle}" • ` : ''}${numQuestions} Questions • Bloom's Taxonomy Citations`}
              </p>
            </div>
          </div>

          {/* Centralized Dynamic Progress & Status Card */}
          <div className="space-y-2.5 rounded-2xl bg-neutral-900/60 p-4 border border-neutral-800/80">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-neutral-400 text-[11px] flex items-center gap-1.5 font-medium">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                Phase {activeStepIndex + 1} of 5: {PIPELINE_STEPS[activeStepIndex].title}
              </span>
              <span className="text-indigo-400 font-bold text-sm tabular-nums">
                {currentProgress}%
              </span>
            </div>

            {/* Single Theme-Based Progress Track */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-800">
              <motion.div
                className="h-full rounded-full bg-indigo-500 relative overflow-hidden shadow-sm shadow-indigo-500/30"
                initial={{ width: 0 }}
                animate={{ width: `${currentProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent w-full"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                />
              </motion.div>
            </div>

            {/* Timers */}
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <Hourglass className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>
                  {isComplete
                    ? 'Finalizing test session...'
                    : remainingSeconds > 0
                      ? `Estimated: ~${remainingSeconds}s remaining`
                      : 'Deep citation verification in progress...'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-[10px]">
                <Clock className="w-3 h-3" />
                <span>Elapsed: {formatTime(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Icon-First Pipeline Stepper (Dashboard Vibe, No Text Clutter) */}
          <div className="grid grid-cols-5 gap-2 py-1">
            {PIPELINE_STEPS.map((step, idx) => {
              const isPast = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex && !isComplete;
              const isDone = isPast || isComplete;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center text-center gap-1.5"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
                        : isCurrent
                          ? 'bg-indigo-600/20 border border-indigo-500/60 text-indigo-400 shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-500/40 animate-pulse'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-500'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>

                  <span
                    className={`text-[10px] sm:text-[11px] font-medium tracking-tight line-clamp-1 max-w-full ${
                      isCurrent
                        ? 'text-indigo-300 font-semibold'
                        : isDone
                          ? 'text-neutral-300'
                          : 'text-neutral-500'
                    }`}
                    title={step.title}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Compact "While You Wait" Study Insight Card */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3.5 py-2.5 flex items-center gap-3">
            <span className="text-base shrink-0">
              {DID_YOU_KNOW_TIPS[tipIndex].icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                <span>While You Wait</span>
                <span className="text-neutral-600">•</span>
                <span className="truncate">{DID_YOU_KNOW_TIPS[tipIndex].title}</span>
              </div>
              <p className="text-xs text-neutral-400 font-normal truncate mt-0.5">
                {DID_YOU_KNOW_TIPS[tipIndex].tip}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
