'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  FileText, 
  UploadCloud, 
  ArrowRight, 
  CheckCircle2,
  BookOpen,
  Brain,
  Sliders
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { uploadPdfDirectToCloudinary } from '@/app/lib/directUpload';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export default function CreateTestPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Tab 1: AI Dual PDF Synthesizer State
  const [aiTitle, setAiTitle] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(10);
  const [contextFiles, setContextFiles] = useState<File[]>([]);
  const [pyqFiles, setPyqFiles] = useState<File[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Tab 2: Manual Question Creator State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDuration, setManualDuration] = useState(30);
  const [manualQuestions, setManualQuestions] = useState<Question[]>([
    {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      difficulty: 'medium',
    },
  ]);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // AI Dual PDF Submission Handler
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTitle) {
      toast.error('Please enter a test title');
      return;
    }
    if (contextFiles.length === 0) {
      toast.error('Please upload at least one Context PDF');
      return;
    }

    setIsGeneratingAi(true);

    try {
      // 1. Upload all context and PYQ PDFs directly to Cloudinary
      toast.info('Uploading documents to cloud storage...');
      const uploadedContextPDFs = await Promise.all(
        contextFiles.map((f) => uploadPdfDirectToCloudinary(f))
      );
      const uploadedPyqPDFs = await Promise.all(
        pyqFiles.map((f) => uploadPdfDirectToCloudinary(f))
      );

      toast.info('Analyzing document citations & synthesizing test...');

      // 2. Post lightweight JSON payload to Next.js API
      const response = await fetch('/api/pdf-tests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: aiTitle,
          description: `Test synthesized from ${uploadedContextPDFs.map((p) => p.name).join(', ')}`,
          domainTopic: aiTopic || 'General',
          numQuestions: aiNumQuestions.toString(),
          contextPDFs: uploadedContextPDFs,
          pyqPDFs: uploadedPyqPDFs,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to synthesize test');
      }

      toast.success('Test synthesized successfully with verified citations!');
      if (data.test?.id) {
        router.push(`/take-test/${data.test.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generating test');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Manual Question Helpers
  const addManualQuestion = () => {
    setManualQuestions([
      ...manualQuestions,
      {
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        explanation: '',
        difficulty: 'medium',
      },
    ]);
  };

  const updateManualQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...manualQuestions];
    (updated[index] as any)[field] = value;
    setManualQuestions(updated);
  };

  const updateManualOption = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...manualQuestions];
    updated[qIndex].options[optIndex] = text;
    setManualQuestions(updated);
  };

  const removeManualQuestion = (index: number) => {
    if (manualQuestions.length > 1) {
      setManualQuestions(manualQuestions.filter((_, i) => i !== index));
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle) {
      toast.error('Please enter a test title');
      return;
    }

    setIsSubmittingManual(true);
    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          duration: manualDuration,
          questions: manualQuestions,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create test');
      }

      toast.success('Custom test created successfully!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create test');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1.5 border-b border-gray-200 dark:border-neutral-800 pb-5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Assessment Authoring Studio
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Create Assessment
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-500">
            Synthesize verified tests from uploaded documents or construct custom question sets.
          </p>
        </div>

        {/* Tab Controls */}
        <Tabs defaultValue="ai-synthesis" className="w-full">
          <div className="mb-6">
            <TabsList className="bg-gray-100/90 dark:bg-neutral-900 p-1 rounded-lg border border-gray-200/80 dark:border-neutral-800 grid grid-cols-2 max-w-md">
              <TabsTrigger
                value="ai-synthesis"
                className="rounded-md px-4 py-2 font-bold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Synthesis
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="rounded-md px-4 py-2 font-bold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Manual Authoring
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: AI Dual PDF Synthesizer */}
          <TabsContent value="ai-synthesis">
            <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
              <CardContent className="p-6 space-y-5">
                <form onSubmit={handleAiSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Assessment Title</Label>
                      <Input
                        required
                        placeholder="e.g., Banking PO Reasoning & Vocab"
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        className="h-10 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Subject / Domain</Label>
                      <Input
                        placeholder="e.g., Vocabulary, Quantitative Aptitude, Law"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        className="h-10 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Context PDFs */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Context Reference Material (Notes, Chapters, Syllabus)
                    </Label>
                    <div className="border border-dashed rounded-lg p-5 text-center border-gray-300 dark:border-neutral-700 hover:border-gray-400 transition-colors bg-gray-50/50 dark:bg-neutral-800/40">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        id="context-pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setContextFiles(Array.from(e.target.files));
                        }}
                      />
                      <label htmlFor="context-pdf" className="cursor-pointer flex flex-col items-center gap-1.5">
                        <UploadCloud className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {contextFiles.length > 0
                            ? `${contextFiles.length} file(s) selected: ${contextFiles.map((f) => f.name).join(', ')}`
                            : 'Upload Context PDF Documents'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Previous Year Questions PDF */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Previous Year Exam Benchmark PDF (Optional)
                    </Label>
                    <div className="border border-dashed rounded-lg p-5 text-center border-gray-300 dark:border-neutral-700 hover:border-gray-400 transition-colors bg-gray-50/50 dark:bg-neutral-800/40">
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        id="pyq-pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setPyqFiles(Array.from(e.target.files));
                        }}
                      />
                      <label htmlFor="pyq-pdf" className="cursor-pointer flex flex-col items-center gap-1.5">
                        <FileText className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {pyqFiles.length > 0
                            ? `${pyqFiles.length} PYQ file(s) selected: ${pyqFiles.map((f) => f.name).join(', ')}`
                            : 'Upload Previous Year Question Papers (Optional)'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Question Count */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Question Quota: {aiNumQuestions} Questions
                    </Label>
                    <div className="flex gap-2">
                      {[5, 10, 15, 20, 25].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setAiNumQuestions(cnt)}
                          className={`h-9 px-3.5 rounded-lg font-bold text-xs transition-all ${
                            aiNumQuestions === cnt
                              ? 'bg-slate-900 text-white shadow-sm dark:bg-indigo-600'
                              : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {cnt} Qs
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isGeneratingAi || contextFiles.length === 0}
                    className="w-full h-11 rounded-lg bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
                  >
                    {isGeneratingAi ? 'Synthesizing with Multimodal OCR...' : 'Synthesize Assessment'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Manual Authoring */}
          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-5">
              <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Assessment Title</Label>
                      <Input
                        required
                        placeholder="e.g., Mechanics Diagnostic Test"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        className="h-10 rounded-lg bg-white dark:bg-neutral-900 text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Duration (Minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        required
                        value={manualDuration}
                        onChange={(e) => setManualDuration(Number(e.target.value))}
                        className="h-10 rounded-lg bg-white dark:bg-neutral-900 text-xs font-medium"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Questions List */}
              <div className="space-y-4">
                {manualQuestions.map((q, qIndex) => (
                  <Card key={qIndex} className="rounded-xl border border-gray-200 dark:border-neutral-800 p-5 space-y-3 bg-white dark:bg-neutral-900 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 text-xs font-semibold">
                        Question {qIndex + 1}
                      </span>
                      {manualQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeManualQuestion(qIndex)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <Textarea
                      required
                      placeholder="Type your question prompt here..."
                      value={q.question}
                      onChange={(e) => updateManualQuestion(qIndex, 'question', e.target.value)}
                      className="min-h-[70px] rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-xs font-medium"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, optIndex) => {
                        const isCorrect = q.correctAnswer === optIndex;
                        const letters = ['A', 'B', 'C', 'D'];

                        return (
                          <div
                            key={optIndex}
                            className={`p-2.5 rounded-lg border flex items-center gap-2.5 transition-all ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                            }`}
                          >
                            <span className="w-5 h-5 rounded bg-gray-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {letters[optIndex]}
                            </span>
                            <Input
                              required
                              placeholder={`Option ${letters[optIndex]}`}
                              value={opt}
                              onChange={(e) => updateManualOption(qIndex, optIndex, e.target.value)}
                              className="border-none shadow-none focus-visible:ring-0 text-xs font-medium p-0 h-6"
                            />
                            <button
                              type="button"
                              onClick={() => updateManualQuestion(qIndex, 'correctAnswer', optIndex)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {isCorrect ? 'Correct' : 'Set Correct'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addManualQuestion}
                  className="h-10 px-4 rounded-lg border-gray-200 dark:border-neutral-800 font-semibold text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Question
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="h-10 px-6 rounded-lg bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm"
                >
                  {isSubmittingManual ? 'Saving...' : 'Publish Assessment'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}