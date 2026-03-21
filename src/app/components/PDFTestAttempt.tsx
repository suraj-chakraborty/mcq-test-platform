'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PDFTest {
  id: string;
  title: string;
  description: string;
  timeLimit?: number;
  duration?: number;
  questions: Question[];
}

export default function PDFTestAttempt({ test }: { test: PDFTest }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  
  const initialDuration = test.duration || test.timeLimit || 30;
  const [timeLeft, setTimeLeft] = useState(initialDuration * 60);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
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

  const handleNext = () => {
     if (currentQuestion < (test.questions?.length || 0) - 1) {
        setCurrentQuestion(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
     }
  };

  const handlePrevious = () => {
     if (currentQuestion > 0) {
        setCurrentQuestion(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
     }
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
          testId: test.id,
          answers,
          timeTaken: (initialDuration * 60) - Math.max(0, timeLeft),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setScore(data.score);
        setShowResults(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.success('Test completed!');
      } else {
         toast.error(data.error || 'Failed to submit test');
      }
    } catch (error) {
      toast.error('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeTime = isNaN(timeLeft) || timeLeft < 0 ? 0 : timeLeft;
  const minutes = Math.floor(safeTime / 60);
  const seconds = safeTime % 60;
  
  const answeredCount = Object.keys(answers).length;
  const progress = ((currentQuestion + 1) / (test.questions?.length || 1)) * 100;

  if (showResults) {
    return (
      <div className="min-h-screen bg-[#fafafc] dark:bg-black/95 transition-colors py-12 px-4 flex justify-center w-full font-sans">
        <div className="w-full max-w-5xl relative">
          <Card className="border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-[#f0f4ff] p-12 text-center relative overflow-hidden">
               <div className="relative z-10">
                  <CardTitle className="text-4xl font-black text-[#4f46e5] mb-2 tracking-tight">Test Results</CardTitle>
                  <div className="text-[#6366f1] font-bold uppercase tracking-widest text-sm">{test.title}</div>
               </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-12 lg:p-16">
              <div className="text-center mb-16">
                <div className="inline-flex items-center justify-center p-8 bg-white rounded-[3rem] shadow-sm border border-gray-100 mb-6">
                   <h2 className="text-6xl font-black text-gray-900 tracking-tighter">{score}%</h2>
                </div>
                <p className="text-lg font-bold text-gray-400">Time Taken: <span className="text-gray-900">{Math.floor(((initialDuration * 60) - safeTime) / 60)}m {((initialDuration * 60) - safeTime) % 60}s</span></p>
              </div>
              
              <div className="space-y-8">
                {test.questions && test.questions.map((question, index) => {
                   const isCorrect = answers[index] === question.correctAnswer;
                   const isAnswered = answers[index] !== undefined;
                   
                   return (
                    <div key={index} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                      <div className="flex gap-4 items-start w-full">
                         <span className={`shrink-0 mt-1 flex items-center justify-center w-8 h-8 rounded-full font-black text-sm border-2 ${isCorrect ? 'bg-[#f0fdf4] border-[#86efac] text-[#16a34a]' : isAnswered ? 'bg-[#fef2f2] border-[#fca5a5] text-[#dc2626]' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                           {index + 1}
                         </span>
                         <div className="flex-1 w-full">
                            <p className="font-bold text-[15px] sm:text-[17px] text-gray-800 mb-6 leading-relaxed">{question.question}</p>
                            <div className="grid grid-cols-1 gap-3 mb-6">
                              {question.options.map((option, optIndex) => {
                                 const isThisOptionCorrect = option === question.correctAnswer;
                                 const isThisOptionSelected = answers[index] === option;
                                 
                                 return (
                                  <div
                                    key={optIndex}
                                    className={`p-4 rounded-2xl border-2 flex items-center gap-3 font-semibold text-sm transition-colors ${
                                      isThisOptionCorrect
                                        ? 'bg-[#f0fdf4] border-[#22c55e] text-[#15803d]'
                                        : isThisOptionSelected
                                        ? 'bg-[#fef2f2] border-[#ef4444] text-[#b91c1c]'
                                        : 'bg-white border-transparent text-gray-500'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isThisOptionCorrect ? 'border-[#22c55e] bg-transparent' : isThisOptionSelected ? 'border-[#ef4444] bg-transparent' : 'border-gray-300'}`}>
                                       {(isThisOptionCorrect || isThisOptionSelected) && <div className={`w-2 h-2 rounded-full ${isThisOptionCorrect ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>}
                                    </div>
                                    {option}
                                  </div>
                                )
                              })}
                            </div>
                            
                            <div className="bg-[#f8fafc] p-6 rounded-2xl border border-gray-100">
                               <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                 Explanation
                               </div>
                              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                                {question.explanation}
                              </p>
                            </div>
                         </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="mt-12 flex justify-center">
                 <Button
                   className="h-12 px-8 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-0.5"
                   onClick={() => router.push('/dashboard')}
                 >
                   Return to Dashboard
                 </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQ = test.questions?.[currentQuestion];

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-black/95 transition-colors w-full flex flex-col items-center font-sans tracking-tight">
      {/* Sticky Full Width Header */}
      <div className="sticky top-0 z-50 w-full flex items-start justify-between px-6 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-6 mb-4 bg-[#fafafc]/95 dark:bg-black/95 backdrop-blur-sm border-b border-transparent transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-[1rem] shadow-sm border border-gray-100/50 flex items-center justify-center p-2.5 shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none mb-1.5">
              {test.title}
            </h1>
            <span className="text-[9px] font-black uppercase text-[#4f46e5] bg-[#eef2ff] px-2.5 py-1 rounded tracking-widest">
              PYQ BASED TEST
            </span>
          </div>
        </div>

        <div className="bg-white rounded-full px-6 py-3 sm:py-4 sm:px-8 shadow-sm border border-gray-100/50 flex flex-col items-center justify-center min-w-[124px] sm:min-w-[140px] shrink-0">
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-300 mb-0.5">TIME LEFT</div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${minutes < 5 ? 'bg-red-500 animate-pulse' : 'bg-[#4f46e5] animate-pulse'}`} />
            <span className={`text-xl sm:text-[1.35rem] tracking-tight font-black tabular-nums transition-colors leading-none ${minutes < 5 ? 'text-red-500' : 'text-[#4f46e5]'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl px-4 pb-12 flex-1 flex flex-col">
        {/* Main Test Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden relative border border-gray-100/40 w-full">
          {/* Progress Bar */}
          <div className="h-1.5 bg-gray-50 w-full relative">
            <motion.div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          <div className="p-6 sm:p-10 lg:p-12 space-y-8 w-full">
            {currentQ && (
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentQuestion}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <div className="mb-6">
                     <span className="bg-[#eef2ff] text-[#4f46e5] px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">
                      QUESTION {currentQuestion + 1} OF {test.questions?.length || 1}
                     </span>
                  </div>
                  
                  <div className="flex gap-4 sm:gap-5 items-start w-full mb-8">
                     <div className="shrink-0 w-8 h-8 bg-[#eef2ff] rounded-full flex items-center justify-center font-black text-xs text-[#4f46e5] mt-0.5">
                       Q
                     </div>
                     <p className="font-bold text-[17px] text-gray-900 leading-snug tracking-tight w-full">
                       {currentQ.question}
                     </p>
                  </div>
                  
                  <RadioGroup
                    value={answers[currentQuestion] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion, value)}
                    className="flex flex-col gap-2.5 pl-0 sm:pl-[52px] w-full"
                  >
                    {currentQ.options.map((option, optIndex) => (
                      <Label
                        key={optIndex}
                        htmlFor={`q${currentQuestion}-o${optIndex}`}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-[1rem] border transition-all cursor-pointer group w-full
                          ${answers[currentQuestion] === option 
                            ? 'border-[#4f46e5] bg-[#fafaff]' 
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                          }
                        `}
                      >
                        <div className={`
                          shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors
                          ${answers[currentQuestion] === option ? 'border-[#4f46e5] bg-transparent' : 'border-gray-200'}
                        `}>
                          <RadioGroupItem value={option} id={`q${currentQuestion}-o${optIndex}`} className="sr-only" />
                          {answers[currentQuestion] === option && <div className="h-2 w-2 rounded-full bg-[#4f46e5] transition-transform scale-100" />}
                        </div>
                        <span className={`text-[13.5px] font-medium leading-relaxed transition-colors ${answers[currentQuestion] === option ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                          {option}
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </motion.div>
              </AnimatePresence>
            )}
            
            <div className="pt-8 flexitems-center flex justify-between gap-4 border-t border-gray-50 w-full mt-2">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="h-10 px-4 font-black text-[9px] uppercase tracking-[0.15em] text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400 disabled:bg-transparent"
              >
                ← PREVIOUS
              </Button>

              {currentQuestion === (test.questions?.length || 1) - 1 ? (
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || answeredCount === 0}
                  className="h-10 w-[140px] bg-gray-900 hover:bg-black text-white rounded-full font-black text-[9px] uppercase tracking-[0.15em] shadow-[0_4px_14px_-4px_rgba(0,0,0,0.3)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? 'SUBMITTING...' : 'FINALIZE TEST'}
                </Button>
              ) : (
                <Button 
                  onClick={handleNext}
                  className="h-10 w-[140px] bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-full font-black text-[9px] uppercase tracking-[0.15em] shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-0.5"
                >
                  NEXT QUESTION →
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}