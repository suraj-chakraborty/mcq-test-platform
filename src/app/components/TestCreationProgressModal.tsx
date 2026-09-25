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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-950/80 backdrop-blur-xl"
      >
        <motion.div
          key="test-creation-modal"
          initial={{ scale: 0.92, y: 24, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl sm:rounded-[2.5rem] bg-white/95 dark:bg-neutral-900/95 border border-indigo-100/80 dark:border-neutral-800 shadow-[0_25px_70px_-15px_rgba(79,70,229,0.35)] p-4 sm:p-8 space-y-4 sm:space-y-6"
        >
          {/* Glowing Background Radial Accents */}
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-black uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
                </span>
                AI Multimodal Synthesis Engine
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Synthesizing Your Test
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-1">
                {`${testTitle ? `"${testTitle}" • ` : ''}${numQuestions} Questions • Bloom's Taxonomy Citations`}
              </p>
            </div>

            {/* Glowing Icon Badge */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/25">
                <div className="w-full h-full rounded-[14px] bg-white dark:bg-neutral-900 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Progress Bar Section */}
          <div className="space-y-3 rounded-2xl bg-gray-50/80 dark:bg-neutral-800/50 p-4 border border-gray-100 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                Phase {activeStepIndex + 1} of 5: {PIPELINE_STEPS[activeStepIndex].title}
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-black text-base tabular-nums">
                {currentProgress}%
              </span>
            </div>

            {/* Visual Progress Bar with Shimmer */}
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-neutral-700/80 p-0.5">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400 relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${currentProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.5 }}
              >
                {/* Internal Animated Shimmer Line */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                />
              </motion.div>
            </div>

            {/* Smart Dual Timer Display */}
            <div className="flex items-center justify-between pt-1 text-xs font-bold text-gray-600 dark:text-gray-300">
              {/* Estimated Time Remaining */}
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <Hourglass className="w-4 h-4 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                <span>
                  {isComplete
                    ? 'Finalizing test session...'
                    : remainingSeconds > 0
                    ? `Estimated: ~${remainingSeconds}s remaining`
                    : 'Deep citation verification in progress...'}
                </span>
              </div>

              {/* Elapsed Time */}
              <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-[11px] font-semibold tabular-nums">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed: {formatTime(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Stepper Pipeline Flow */}
          <div className="space-y-2">
            {PIPELINE_STEPS.map((step, idx) => {
              const isPast = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex && !isComplete;
              const isDone = isPast || isComplete;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 ${
                    isCurrent
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 shadow-sm'
                      : isDone
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-gray-500 dark:text-gray-400'
                      : 'opacity-40 text-gray-400 dark:text-neutral-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                        : isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 animate-pulse'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-400'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs font-black truncate ${
                          isCurrent
                            ? 'text-indigo-950 dark:text-indigo-200'
                            : isDone
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive "While You Wait" Study Insight Card */}
          <div className="rounded-2xl border border-indigo-100/60 dark:border-neutral-800 bg-gradient-to-br from-indigo-50/40 via-purple-50/30 to-pink-50/20 dark:from-neutral-800/40 dark:via-neutral-800/30 dark:to-neutral-800/20 p-3.5">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">
                {DID_YOU_KNOW_TIPS[tipIndex].icon}
              </span>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  While You Wait • {DID_YOU_KNOW_TIPS[tipIndex].title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                  {DID_YOU_KNOW_TIPS[tipIndex].tip}
                </p>
              </div>
            </div>
          </div>

          {/* Anti-Crash Reassurance Footer */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              Real-time synthesis active • Please keep this tab open while questions are verified
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
