'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Brain,
  Rocket,
  Sparkles,
  Quote,
  Trophy,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface Flashcard {
  id: string;
  question: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  };
}

interface FlashcardDeckProps {
  cards: Flashcard[];
  onComplete: () => void;
}

export default function FlashcardDeck({ cards, onComplete }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionCards] = useState(cards);

  const currentCard = sessionCards[currentIndex];

  const handleReview = async (quality: number) => {
    if (isSubmitting || !currentCard) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality }),
      });

      if (res.ok) {
        setReviewedCount((prev) => prev + 1);
        if (currentIndex < sessionCards.length - 1) {
          setIsFlipped(false);
          setTimeout(() => {
            setCurrentIndex((prev) => prev + 1);
            setIsSubmitting(false);
          }, 300);
        } else {
          setIsFinished(true);
          setIsSubmitting(false);
          toast.success('Session complete! Great job brainiac! 🧠');
        }
      } else {
        toast.error('Failed to save review');
        setIsSubmitting(false);
      }
    } catch {
      toast.error('Failed to save review');
      setIsSubmitting(false);
    }
  };

  // Completion Screen
  if (isFinished || !currentCard) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#121316] border border-neutral-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
            <Trophy className="w-10 h-10 text-emerald-400" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            Session Completed!
          </h2>
          <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-8">
            You reviewed <span className="text-emerald-400 font-bold">{reviewedCount || sessionCards.length}</span> flashcards. Your spaced repetition schedule has been updated.
          </p>

          <Button
            onClick={onComplete}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Back to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / sessionCards.length) * 100);

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-8 px-4">
      {/* Top Header matching Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Study Session</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Reviewing {sessionCards.length} Cards
          </h2>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center bg-[#131418] border border-neutral-800 px-4 py-2 rounded-2xl shadow-sm">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-neutral-400">Card</span>
          <span className="text-sm font-extrabold text-white">{currentIndex + 1}</span>
          <span className="text-xs text-neutral-600">/</span>
          <span className="text-xs font-semibold text-neutral-400">{sessionCards.length}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-900 border border-neutral-800/80 h-2 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 3D Flip Flashcard */}
      <div className="relative min-h-[380px] sm:min-h-[420px] perspective-1000 mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex + (isFlipped ? '-flipped' : '')}
            initial={{ rotateY: isFlipped ? -180 : 0, opacity: 0, scale: 0.95 }}
            animate={{ rotateY: isFlipped ? 180 : 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, type: 'spring', damping: 22 }}
            className={`w-full min-h-[380px] sm:min-h-[420px] cursor-pointer rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${
              isFlipped
                ? 'bg-[#15161e] border-2 border-indigo-500/40 shadow-indigo-500/5'
                : 'bg-[#121316] border border-neutral-800 hover:border-indigo-500/40 hover:shadow-indigo-500/10'
            }`}
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            {/* Background Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {!isFlipped ? (
              /* FRONT: QUESTION */
              <div className="h-full flex flex-col items-center justify-center text-center my-auto">
                {/* Modern Glowing Icon Badge */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-inner shadow-indigo-500/20">
                  <Brain className="w-8 h-8 text-indigo-400" />
                </div>

                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
                  Question Prompt
                </span>

                <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed max-w-lg mx-auto">
                  {currentCard.question.question}
                </p>

                <div className="mt-8 flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tap to reveal Answer</span>
                </div>
              </div>
            ) : (
              /* BACK: ANSWER & EXPLANATION */
              <div className="rotate-y-180 w-full flex flex-col items-center justify-center text-center my-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Correct Answer</span>
                </div>

                <p className="text-2xl sm:text-3xl font-extrabold text-white mb-6 leading-snug max-w-lg">
                  {currentCard.question.options[currentCard.question.correctAnswer]}
                </p>

                {currentCard.question.explanation && (
                  <div className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-5 text-left mb-2 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      <Quote className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Key Explanation</span>
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed font-normal">
                      {currentCard.question.explanation}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  className="mt-4 text-xs font-semibold text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Flip back to Question</span>
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Area */}
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {isFlipped ? (
            /* RATING BUTTONS (SM-2 SRS) */
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 15, opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold px-1">
                <span>Rate recall quality:</span>
                <span className="text-indigo-400 font-medium">SM-2 Spaced Repetition</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleReview(1)}
                  disabled={isSubmitting}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-[#16171d] border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5 text-rose-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Forget</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReview(3)}
                  disabled={isSubmitting}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-[#16171d] border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Hard</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReview(4)}
                  disabled={isSubmitting}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-[#16171d] border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Good</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReview(5)}
                  disabled={isSubmitting}
                  className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 bg-[#16171d] border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Rocket className="h-5 w-5 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Perfect</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* REVEAL ANSWER BUTTON */
            <Button
              className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-base font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => setIsFlipped(true)}
            >
              <RotateCcw className="w-5 h-5 text-white" />
              <span>REVEAL ANSWER</span>
            </Button>
          )}
        </AnimatePresence>

        <Button
          variant="ghost"
          className="text-neutral-400 hover:text-white font-semibold text-xs mt-1 self-center"
          onClick={onComplete}
        >
          End Session
        </Button>
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
