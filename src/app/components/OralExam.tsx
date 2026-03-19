'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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
        console.error('OCR Error:', err);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setEvaluation(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const submitExplanation = async () => {
    if (!transcript) return;
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/descriptive/oral-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, transcript })
      });
      const data = await res.json();
      if (data.success) {
        setEvaluation(data.evaluation);
        toast.success('Evaluation complete! Check your clarity score.');
      } else {
        toast.error(data.error || 'Failed to evaluate');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden border-none text-gray-900">
        <div className="bg-indigo-600 p-8 text-white">
           <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="h-6 w-6 text-amber-300" />
                 </div>
                 <h2 className="text-2xl font-black">Oral Exam Mode</h2>
              </div>
              <Button variant="ghost" onClick={onClose} className="text-white/80 hover:text-white rounded-full">Close</Button>
           </div>
           <p className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mb-2">Subjective Challenge</p>
           <h3 className="text-xl font-bold leading-tight">{question}</h3>
        </div>

        <CardContent className="p-8">
           {!evaluation ? (
             <div className="space-y-8">
                <div className="bg-gray-50 rounded-[30px] p-8 min-h-[200px] border-2 border-dashed border-gray-200 flex items-center justify-center relative group">
                   {transcript ? (
                     <p className="text-gray-600 text-lg font-medium leading-relaxed italic">"{transcript}"</p>
                   ) : (
                     <p className="text-gray-300 font-black tracking-tighter text-3xl opacity-50 uppercase">Ready to Listen...</p>
                   )}
                   {isListening && (
                     <div className="absolute top-4 right-4 flex gap-1">
                        {[1, 2, 3].map(i => (
                          <motion.div 
                            key={i} 
                            animate={{ height: [8, 16, 8] }} 
                            transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} 
                            className="w-1 bg-indigo-600 rounded-full" 
                          />
                        ))}
                     </div>
                   )}
                </div>

                <div className="flex flex-col items-center gap-6">
                   <Button 
                     onClick={toggleListening}
                     className={`h-24 w-24 rounded-full shadow-2xl transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 ring-8 ring-red-50' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'}`}
                   >
                     {isListening ? <MicOff className="h-10 w-10 text-white" /> : <Mic className="h-10 w-10 text-white" />}
                   </Button>
                   <p className="text-gray-500 font-bold text-sm">{isListening ? 'Tap to stop' : 'Tap to start explaining'}</p>

                   {transcript && !isListening && (
                     <Button 
                       onClick={submitExplanation}
                       disabled={isEvaluating}
                       className="w-full h-16 rounded-[20px] bg-indigo-600 text-lg font-black tracking-tight"
                     >
                       {isEvaluating ? (
                         <div className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            ANALYZING CLARITY...
                         </div>
                       ) : 'GET ORAL GRADE'}
                     </Button>
                   )}
                </div>
             </div>
           ) : (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex justify-between items-end">
                   <div>
                      <h4 className="text-4xl font-black text-indigo-600">{evaluation.score}/100</h4>
                      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Global Clarity Score</p>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${evaluation.clarityRating === 'Excellent' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{evaluation.clarityRating} Clarity</span>
                      <span className="text-[10px] font-black uppercase text-gray-300 mt-1">Completeness: {evaluation.completenessRating}</span>
                   </div>
                </div>

                <div className="p-6 bg-indigo-50 rounded-3xl">
                   <p className="text-gray-700 font-medium italic">"{evaluation.feedback}"</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <h5 className="font-black text-gray-900 text-xs uppercase flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Key Strengths
                      </h5>
                      <ul className="space-y-2">
                         {evaluation.strengths.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-gray-500 font-medium flex gap-2">
                               <span className="text-green-500 font-bold">•</span>
                               {s}
                            </li>
                         ))}
                      </ul>
                   </div>
                   <div className="space-y-3">
                      <h5 className="font-black text-gray-900 text-xs uppercase flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                        Areas for Growth
                      </h5>
                      <ul className="space-y-2">
                         {evaluation.areasToImprove.map((a: string, i: number) => (
                            <li key={i} className="text-xs text-gray-500 font-medium flex gap-2">
                               <span className="text-amber-500 font-bold">•</span>
                               {a}
                            </li>
                         ))}
                      </ul>
                   </div>
                </div>

                <Button onClick={() => setEvaluation(null)} variant="outline" className="w-full h-14 rounded-2xl font-bold border-2 border-gray-100 hover:bg-gray-50">Retake Oral Exam</Button>
             </motion.div>
           )}
        </CardContent>
      </motion.div>
    </div>
  );
}
