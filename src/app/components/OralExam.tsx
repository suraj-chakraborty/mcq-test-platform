'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, X, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner as Loading } from './LoadingSpinner';

interface OralExamProps {
  question: string;
  onClose: () => void;
}

export default function OralExam({ question, onClose }: OralExamProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        toast.error('Speech recognition is not supported in this browser.');
        return;
      }
      setTranscript('');
      setEvaluation(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
        setIsListening(false);
      }
    }
  };

  const submitExplanation = async () => {
    if (!transcript.trim()) {
      toast.error('Please speak your answer before submitting.');
      return;
    }
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/descriptive/oral-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, transcript }),
      });
      const data = await res.json();
      if (data.success) {
        setEvaluation(data.evaluation);
        toast.success('Oral response evaluated successfully!');
      } else {
        toast.error(data.error || 'Failed to evaluate oral answer');
      }
    } catch (err) {
      toast.error('Connection error. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <AnimatePresence>
        {isEvaluating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center"
          >
            <Loading />
            <p className="mt-4 text-sm font-semibold text-white">Analyzing verbal clarity and thesis defense...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#121316] text-white rounded-2xl sm:rounded-3xl border border-neutral-800 shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-800/90 bg-[#16171b]">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700/80 p-2 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="App Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Oral Exam Mode</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Live Defense
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Verbal thesis defense & clarity assessment
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="h-8 w-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Defense Question Callout */}
          <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-[#0c0d10] border border-neutral-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
              Defense Prompt
            </span>
            <p className="text-sm font-semibold text-neutral-200 leading-relaxed">
              {question}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {!evaluation ? (
            <div className="space-y-6">
              {/* Transcription & Audio Stage */}
              <div className="bg-[#0a0b0e] rounded-2xl p-5 sm:p-6 min-h-[200px] border border-neutral-800 flex flex-col justify-between relative group">
                {/* Audio Status Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-800/70">
                  <div className="flex items-center gap-2">
                    {isListening ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs font-semibold text-rose-400 tracking-wide">
                          Listening to speech...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-neutral-600" />
                        <span className="text-xs font-semibold text-neutral-400">
                          {transcript ? 'Dictation paused' : 'Microphone ready'}
                        </span>
                      </>
                    )}
                  </div>

                  {isListening ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [6, 18, 6] }}
                          transition={{ repeat: Infinity, duration: 0.5 + i * 0.08, ease: 'easeInOut' }}
                          className="w-1 bg-indigo-500 rounded-full"
                        />
                      ))}
                    </div>
                  ) : (
                    transcript && (
                      <span className="text-[11px] font-mono text-neutral-400">
                        {transcript.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    )
                  )}
                </div>

                {/* Transcript Body */}
                <div className="flex-1 flex items-center justify-center my-2">
                  {transcript ? (
                    <div className="w-full max-h-[160px] overflow-y-auto pr-1">
                      <p className="text-neutral-200 text-sm sm:text-base font-normal leading-relaxed">
                        "{transcript}"
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm font-semibold text-neutral-300">Ready to listen...</p>
                      <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                        Tap the microphone below to present your thesis and arguments verbally.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center gap-4">
                <Button
                  onClick={toggleListening}
                  className={`h-16 w-16 rounded-full shadow-lg transition-all flex items-center justify-center cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-4 ring-rose-500/20 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-105 active:scale-95'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                  {isListening ? <MicOff className="h-7 w-7 text-white" /> : <Mic className="h-7 w-7 text-white" />}
                </Button>
                <p className={`text-xs font-semibold ${isListening ? 'text-rose-400' : 'text-neutral-400'}`}>
                  {isListening ? 'Tap to pause recording' : 'Tap to start speaking'}
                </p>

                {transcript && !isListening && (
                  <div className="flex items-center gap-3 w-full pt-2">
                    <Button
                      onClick={submitExplanation}
                      disabled={isEvaluating}
                      className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25"
                    >
                      {isEvaluating ? 'Evaluating Clarity...' : 'Evaluate Oral Answer'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTranscript('');
                        setEvaluation(null);
                      }}
                      disabled={isEvaluating}
                      className="h-11 px-4 rounded-xl border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Evaluation Results */
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Score Header */}
              <div className="bg-[#16171b] border border-neutral-800 rounded-xl p-4 sm:p-5 flex items-center justify-between">
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-white">
                    {evaluation.score}
                    <span className="text-base sm:text-lg font-bold text-neutral-400">/100</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-0.5">
                    Verbal Clarity Score
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      evaluation.clarityRating === 'Excellent'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {evaluation.clarityRating} Clarity
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-400">
                    Completeness: {evaluation.completenessRating}
                  </span>
                </div>
              </div>

              {/* Feedback Quote */}
              <div className="p-4 bg-[#0a0b0e] border border-neutral-800 rounded-xl">
                <p className="text-neutral-300 text-xs sm:text-sm font-medium italic leading-relaxed">
                  "{evaluation.feedback}"
                </p>
              </div>

              {/* Strengths & Growth Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#16171b] border border-neutral-800 rounded-xl space-y-2.5">
                  <h5 className="font-bold text-neutral-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Key Strengths
                  </h5>
                  <ul className="space-y-1.5">
                    {evaluation.strengths?.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-neutral-300 font-medium flex gap-2">
                        <span className="text-emerald-400 font-bold shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-[#16171b] border border-neutral-800 rounded-xl space-y-2.5">
                  <h5 className="font-bold text-neutral-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                    Areas for Growth
                  </h5>
                  <ul className="space-y-1.5">
                    {evaluation.areasToImprove?.map((a: string, i: number) => (
                      <li key={i} className="text-xs text-neutral-300 font-medium flex gap-2">
                        <span className="text-amber-400 font-bold shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Retake & Done Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => {
                    setEvaluation(null);
                    setTranscript('');
                  }}
                  className="flex-1 h-11 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Retake Oral Exam
                </Button>
                <Button
                  onClick={onClose}
                  className="h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
