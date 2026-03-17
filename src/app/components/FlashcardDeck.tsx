'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, RotateCcw, Brain, Rocket, Flag } from 'lucide-react';

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
  const [sessionCards, setSessionCards] = useState(cards);

  const currentCard = sessionCards[currentIndex];

  const handleReview = async (quality: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality })
      });

      if (res.ok) {
        if (currentIndex < sessionCards.length - 1) {
          setIsFlipped(false);
          setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setIsSubmitting(false);
          }, 300);
        } else {
          toast.success('Session complete! Great job brainiac! 🧠');
          onComplete();
        }
      }
    } catch (err) {
      toast.error('Failed to save review');
      setIsSubmitting(false);
    }
  };

  if (!currentCard) return null;

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col">
           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Study Session</span>
           <h2 className="text-2xl font-black text-gray-900">Reviewing {sessionCards.length} Cards</h2>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 font-black text-indigo-600">
           {currentIndex + 1} / {sessionCards.length}
        </div>
      </div>

      <div className="relative h-[400px] perspective-1000 mb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex + (isFlipped ? '-flipped' : '')}
            initial={{ rotateY: isFlipped ? -180 : 0, opacity: 0, scale: 0.9 }}
            animate={{ rotateY: isFlipped ? 180 : 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: 'spring', damping: 20 }}
            className={`w-full h-full cursor-pointer rounded-[40px] shadow-2xl overflow-hidden ${
              isFlipped ? 'bg-white' : 'bg-indigo-600'
            }`}
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <div className="h-full flex flex-col p-10 items-center justify-center text-center">
              {!isFlipped ? (
                <>
                  <Brain className="h-16 w-16 text-indigo-300 mb-6 animate-pulse" />
                  <p className="text-2xl font-bold text-white leading-tight">
                    {currentCard.question.question}
                  </p>
                  <span className="absolute bottom-10 text-[10px] font-black text-indigo-300 uppercase tracking-widest">Tap to reveal Answer</span>
                </>
              ) : (
                <div className="rotate-y-180 w-full">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">Correct Answer</span>
                  <p className="text-3xl font-black text-gray-900 mb-6">
                    {currentCard.question.options[currentCard.question.correctAnswer]}
                  </p>
                  {currentCard.question.explanation && (
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-left">
                       <p className="text-sm font-medium text-gray-700 leading-relaxed italic">
                         "{currentCard.question.explanation}"
                       </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-6">
        <AnimatePresence>
          {isFlipped && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="grid grid-cols-4 gap-3"
            >
               <Button onClick={() => handleReview(1)} variant="outline" className="h-16 rounded-3xl flex flex-col items-center justify-center border-red-100 text-red-600 hover:bg-red-50">
                  <XCircle className="h-5 w-5 mb-1" />
                  <span className="text-[8px] font-black uppercase">Forget</span>
               </Button>
               <Button onClick={() => handleReview(3)} variant="outline" className="h-16 rounded-3xl flex flex-col items-center justify-center border-amber-100 text-amber-600 hover:bg-amber-50">
                  <RotateCcw className="h-5 w-5 mb-1" />
                  <span className="text-[8px] font-black uppercase">Hard</span>
               </Button>
               <Button onClick={() => handleReview(4)} variant="outline" className="h-16 rounded-3xl flex flex-col items-center justify-center border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                  <CheckCircle2 className="h-5 w-5 mb-1" />
                  <span className="text-[8px] font-black uppercase">Good</span>
               </Button>
               <Button onClick={() => handleReview(5)} className="h-16 rounded-3xl flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100">
                  <Rocket className="h-5 w-5 mb-1" />
                  <span className="text-[8px] font-black uppercase">Perfect</span>
               </Button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isFlipped && (
          <Button 
            className="h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black shadow-xl shadow-indigo-100"
            onClick={() => setIsFlipped(true)}
          >
            REVEAL ANSWER
          </Button>
        )}
        
        <Button variant="ghost" className="text-gray-400 font-bold" onClick={onComplete}>End Session</Button>
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
