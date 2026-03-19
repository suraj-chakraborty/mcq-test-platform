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
        toast.success('Math problems generated! AI logic applied. ✨');
        onSuccess(data.test);
      } else {
        toast.error(data.error || 'Failed to process image');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

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
               OCR Math Solver
             </CardTitle>
             <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Snap a photo to generate MCQs</p>
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
                         ANALYZING...
                       </div>
                     ) : (
                       'SOLVE & GENERATE'
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
