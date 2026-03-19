'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface MathPhotoUploadProps {
  onSuccess: (test: any) => void;
  onClose: () => void;
}

export default function MathPhotoUpload({ onSuccess, onClose }: MathPhotoUploadProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'capture' | 'solution'>('capture');
  const [solutionData, setSolutionData] = useState<{ original: string, solutionSteps: any[], finalAnswer: string, test: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleSolve = async () => {
    if (!image) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/tests/ocr-math', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      });
      const data = await res.json();
      if (data.success) {
        setSolutionData({
          original: data.originalQuestion,
          solutionSteps: data.solutionSteps,
          finalAnswer: data.finalAnswer,
          test: data.test
        });
        setView('solution');
        toast.success('Strategy generated! Learn the steps then practice. 🎓');
      } else {
        toast.error(data.error || 'Failed to process image');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (view === 'solution' && solutionData) {
    return (
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] rounded-[3rem] overflow-hidden flex flex-col h-full bg-[#f8fafc]">
            <CardHeader className="bg-white border-b border-gray-100 p-8 shrink-0 relative">
               <Button variant="ghost" size="icon" className="absolute right-6 top-6 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl" onClick={onClose}><X className="h-6 w-6" /></Button>
               <div className="flex items-center gap-4 mb-2">
                 <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Sparkles className="h-6 w-6 text-white" />
                 </div>
                 <div>
                    <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">AI Solver Lab</CardTitle>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Educational Analysis</p>
                 </div>
               </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto custom-scrollbar flex-1">
               <div className="p-8 space-y-10">
                  {/* Top Section: Snapshot and Extracted Problem */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-5 space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 pl-1">Input Snap</h4>
                       <div className="rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-100/50 border-8 border-white bg-white aspect-[4/3]">
                          <img src={image!} alt="Snap" className="w-full h-full object-contain" />
                       </div>
                    </div>
                    <div className="lg:col-span-7 space-y-4 pt-1">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 pl-1">Extracted Problem</h4>
                       <div className="p-8 rounded-[2.5rem] bg-white shadow-sm border border-gray-100 text-xl font-bold text-gray-800 leading-relaxed italic">
                          "{solutionData.original}"
                       </div>
                    </div>
                  </div>

                  {/* Step-by-Step Breakdown */}
                  <div className="space-y-6 pt-4">
                     <div className="flex items-center justify-between mb-8">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 pl-1 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Mastery Strategy
                        </h4>
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{solutionData.solutionSteps.length} Logical Steps</span>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-6">
                        {solutionData.solutionSteps.map((step, idx) => (
                           <motion.div 
                             key={idx}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: 0.1 * idx }}
                             className="group relative pl-12"
                           >
                              {/* Connector Logic */}
                              {idx !== solutionData.solutionSteps.length - 1 && (
                                <div className="absolute left-[23px] top-[48px] bottom-[-24px] w-0.5 bg-gray-100 group-hover:bg-indigo-100 transition-colors" />
                              )}
                              
                              <div className="absolute left-0 top-0 h-12 w-12 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center font-black text-indigo-600 transition-all group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white z-10">
                                 {idx + 1}
                              </div>
                              
                              <div className="p-8 rounded-[2.5rem] bg-white border border-transparent shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:border-indigo-100 transition-all duration-300">
                                 <h5 className="text-lg font-black text-gray-900 mb-3">{step.title}</h5>
                                 <p className="text-gray-500 font-medium leading-relaxed mb-6">{step.content}</p>
                                 {step.math && (
                                   <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 font-mono text-indigo-600 font-bold text-xl overflow-x-auto">
                                      {step.math}
                                   </div>
                                 )}
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  </div>

                  {/* Final Output */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-10 border-t border-gray-100"
                  >
                     <div className="p-10 rounded-[3rem] bg-gradient-to-br from-gray-900 to-indigo-900 text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-1000">
                           <Sparkles className="h-32 w-32" />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 mb-6">Final Expression</h4>
                        <div className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
                           {solutionData.finalAnswer}
                        </div>
                        <p className="text-indigo-200 text-sm font-medium">Concept mastered! Ready for AI-generated practice?</p>
                     </div>
                  </motion.div>
               </div>
            </CardContent>
            
            <div className="p-8 bg-white border-t border-gray-100 shrink-0 flex flex-col items-center">
               <Button 
                 className="w-full max-w-md h-20 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-xl font-black shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] flex items-center justify-center gap-4 group relative overflow-hidden"
                 onClick={() => onSuccess(solutionData.test)}
               >
                 <span className="relative z-10">TEST YOUR KNOWLEDGE</span>
                 <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform relative z-10" />
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
               </Button>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6">Generated 5 unique MCQs based on this logic</p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden">
          <CardHeader className="bg-indigo-600 text-white p-6 relative">
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-4 text-white/80 hover:text-white"
                onClick={onClose}
             >
               <X className="h-6 w-6" />
             </Button>
             <CardTitle className="text-2xl font-black flex items-center gap-3">
               <Sparkles className="h-6 w-6 text-amber-300" />
               Math Snap & Learn
             </CardTitle>
             <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Snap &rarr; Solve &rarr; Practice</p>
          </CardHeader>
          <CardContent className="p-8">
             <div className="mb-8">
                {image ? (
                  <div className="relative group rounded-3xl overflow-hidden shadow-lg aspect-video bg-gray-100">
                    <img src={image} alt="Problem" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                       <Button variant="secondary" className="rounded-2xl font-bold" onClick={() => setImage(null)}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-4 border-dashed border-gray-100 rounded-[40px] h-64 flex flex-col items-center justify-center transition-colors hover:border-indigo-100 group cursor-pointer"
                    onClick={handleCapture}
                  >
                     <div className="h-20 w-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Camera className="h-10 w-10 text-indigo-600" />
                     </div>
                     <p className="text-gray-400 font-bold tracking-tight">Tap to capture or upload</p>
                     <span className="text-[10px] uppercase font-black text-gray-300 mt-2 tracking-widest">Handwritten or Printed</span>
                  </div>
                )}
                <input 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   ref={fileInputRef} 
                   onChange={handleFileChange}
                   capture="environment"
                />
             </div>

             <div className="flex gap-4">
                {image && (
                   <Button 
                     className="flex-1 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black shadow-xl shadow-indigo-100"
                     onClick={handleSolve}
                     disabled={isProcessing}
                   >
                     {isProcessing ? (
                       <div className="flex items-center gap-3">
                         <Loader2 className="h-6 w-6 animate-spin" />
                         SOLVING...
                       </div>
                     ) : (
                       'ANALYZE & SOLVE'
                     )}
                   </Button>
                )}
             </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
