'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  HelpCircle, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Brain,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { uploadPdfDirectToCloudinary } from '@/app/lib/directUpload';

const TOPIC_PRESETS = [
  { label: 'Vocabulary & English', icon: '📖', value: 'Vocabulary & English Language' },
  { label: 'Quantitative Aptitude', icon: '📐', value: 'Quantitative Aptitude & Mathematics' },
  { label: 'Science & Technology', icon: '🔬', value: 'Science & Technology' },
  { label: 'Polity & Constitution', icon: '🏛️', value: 'Indian Polity & Governance' },
  { label: 'History & Culture', icon: '🏺', value: 'History & Culture' },
  { label: 'General Awareness', icon: '💡', value: 'General Knowledge & Current Affairs' },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];

export default function UploadPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [files, setFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState(0);

  const steps = [
    'Securely Uploading Document to Cloud...',
    'Extracting Key Concepts & Citations...',
    'Analyzing Subject Archetype & Domain Topics...',
    'Generating High-Yield Questions & Formats...',
    'Auditing Verifiable Source Proofs & Citations...',
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      toast.error('Please select a valid PDF file.');
      return;
    }
    if (pdfFiles[0].size > 50 * 1024 * 1024) {
      toast.error('File size exceeds maximum limit of 50MB.');
      return;
    }
    setFiles(pdfFiles);
    toast.success(`Selected "${pdfFiles[0].name}"`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleGenerate = async () => {
    if (files.length === 0) {
      toast.error('Please upload a PDF document first.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep(0);
    setUploadProgress(10);

    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 3500);

    try {
      // 1. Direct Cloudinary Upload (Bypasses Netlify 4.5MB Payload limit)
      const uploadedPdf = await uploadPdfDirectToCloudinary(files[0], (pct) => {
        setUploadProgress(Math.max(10, Math.min(90, pct)));
      });

      setUploadProgress(100);

      // 2. Send lightweight JSON to API
      const response = await fetch('/api/pdfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directUploads: [uploadedPdf],
          domainTopic: topic || 'General',
          numQuestions: numQuestions.toString(),
        }),
      });

      clearInterval(stepInterval);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test');
      }

      toast.success('Test generated with verified source citations!');
      const createdTestId = data.tests?.[0]?.id;
      if (createdTestId) {
        router.push(`/take-test/${createdTestId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      clearInterval(stepInterval);
      toast.error(err instanceof Error ? err.message : 'Generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider border border-indigo-200/50">
            <Sparkles className="w-3.5 h-3.5" /> AI Multimodal Ingestion Engine
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
            Transform Any PDF into an <span className="gradient-text">Interactive Test</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-2xl mx-auto font-medium">
            Upload notes, question banks, or scanned textbooks. Our AI analyzes the document and synthesizes verified MCQs with exact source citations.
          </p>
        </div>

        {/* Main Generator Studio Card */}
        <Card className="glass-card rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-neutral-800">
          <CardContent className="p-6 sm:p-10 space-y-8">
            {/* Step 1: Dropzone */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-[10px]">
                  1
                </span>
                Upload PDF Document
              </label>

              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                    : files.length > 0
                    ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-neutral-700 hover:border-indigo-400 hover:bg-gray-50/50 dark:hover:bg-neutral-900/50'
                }`}
              >
                <input {...getInputProps()} />

                {files.length > 0 ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 dark:text-white text-base">
                        {files[0].name}
                      </p>
                      <p className="text-xs font-bold text-gray-400 mt-0.5">
                        {(files[0].size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Ingestion
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 hover:underline mt-2">
                      Click or drop another file to replace
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 dark:text-white text-base">
                        Drag and drop your PDF here, or <span className="text-indigo-600">browse files</span>
                      </p>
                      <p className="text-xs font-medium text-gray-400 mt-1">
                        Supports text PDFs, scanned documents, handwritten notes up to 25MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Subject / Topic Selection */}
            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-[10px]">
                  2
                </span>
                Subject / Topic Context
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {TOPIC_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setTopic(preset.value)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                      topic === preset.value
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm'
                        : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-base">{preset.icon}</span>
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>

              <Input
                placeholder="Or type a custom topic (e.g. Constitutional Law, Calculus Limits, World War II)..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-12 rounded-2xl bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-sm font-medium"
              />
            </div>

            {/* Step 3: Question Count */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-[10px]">
                  3
                </span>
                Number of Questions
              </label>

              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setNumQuestions(cnt)}
                    className={`h-11 px-5 rounded-2xl font-black text-xs transition-all ${
                      numQuestions === cnt
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Features Pill Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Verifiable Source Citations</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Arbitrary Length Scaling</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400">
                <Brain className="w-4 h-4 text-purple-500" />
                <span>Adaptive Question Intelligence</span>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <Button
                disabled={files.length === 0 || isGenerating}
                onClick={handleGenerate}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Document...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Generate AI Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Generation Progress Modal */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white dark:bg-neutral-900 max-w-md w-full rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-neutral-800 text-center space-y-6"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center animate-pulse">
                  <Brain className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    Generating Assessment
                  </h3>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 min-h-[20px]">
                    {steps[generationStep]}
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  {steps.map((st, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 text-xs font-bold p-2.5 rounded-xl transition-colors ${
                        i < generationStep
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                          : i === generationStep
                          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 animate-pulse'
                          : 'text-gray-300 dark:text-neutral-700'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${i <= generationStep ? 'opacity-100' : 'opacity-20'}`} />
                      <span>{st}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-gray-400 font-medium">
                  Extracting formulas, terms, and diagrams with anti-hallucination ground truth.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}