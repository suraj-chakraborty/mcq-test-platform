'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import Truncate from './Truncate';

import { LoadingSpinner as Loading } from './LoadingSpinner';

import { uploadPdfDirectToCloudinary } from '@/app/lib/directUpload';

interface MCQQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface PdfDocument {
  id: string;
  title: string;
  name?: string;
  url: string;
  createdAt: string;
  fileSize: number;
  pageCount: number;
  mcqs: MCQQuestion[];
}

interface PdfUploadProps {
  onUploadSuccess?: () => void;
  onUploadPending?: () => void;
  onUploadError?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
} as const;

export default function PdfUpload({ onUploadSuccess, onUploadPending, onUploadError }: PdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with-mcqs' | 'without-mcqs'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  const [showModal, ShowModal] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [domainTopic, setDomainTopic] = useState('');
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [showMcqs, setShowMcqs] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [isTestStarting, setIsTestStarting] = useState(false);
  const [testStartError, setTestStartError] = useState<string | null>(null);
  const router = useRouter();

  const fetchPdfs = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedTopic && selectedTopic !== 'all' && { topic: selectedTopic }),
      });

      const res = await fetch(`/api/pdfs?${queryParams}`);
      if (!res.ok) {
        throw new Error('Failed to fetch PDFs');
      }
      const data = await res.json();
      setPdfs(data.pdfs || data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Error fetching PDFs:', err);
      toast.error('Failed to load PDFs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, [page, searchTerm, selectedTopic]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} exceeds max size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return false;
      }
      if (!(file.type in ACCEPTED_FILE_TYPES) && !file.name.endsWith('.pdf')) {
        toast.error(`File ${file.name} is not a PDF`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;
    setCurrentFiles(validFiles);
    ShowModal(true);
  }, []);

  const handleUploadWithForm = async () => {
    if (!domainTopic || numQuestions <= 0) {
      toast.error("Please fill all fields");
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);
    onUploadPending?.();

    try {
      // 1. Direct upload each PDF file to Cloudinary (bypasses Netlify 4.5MB limit)
      toast.info('Uploading documents to secure cloud storage...');
      const uploadedList = await Promise.all(
        currentFiles.map((file) =>
          uploadPdfDirectToCloudinary(file, (percent) => {
            setUploadProgress(Math.max(10, Math.min(90, percent)));
          })
        )
      );

      setUploadProgress(95);
      toast.info('Synthesizing questions & source citations...');

      // 2. Post lightweight JSON payload to Next.js API
      const response = await fetch('/api/pdfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directUploads: uploadedList,
          numQuestions: numQuestions.toString(),
          domainTopic,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process PDFs');
      }

      setUploadProgress(100);
      setMcqs(data.mcqs || []);
      setShowMcqs(true);
      ShowModal(false);
      toast.success('PDFs uploaded and questions synthesized successfully!');
      onUploadSuccess?.();
      fetchPdfs();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      onUploadError?.();
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartTest = async (type: 'pdf' | 'current-affairs' | 'general-knowledge', pdfIds?: string[]) => {
    try {
      const response = await fetch('/api/tests/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          type === 'pdf'
            ? { pdfIds }
            : { type }
        ),
      });

      if (!response.ok) {
        throw new Error('Failed to start test');
      }

      const data = await response.json();
      router.push(`/take-test/${data.testId}`);
    } catch (error) {
      toast.error('Failed to start test');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
    disabled: isUploading,
    maxSize: MAX_FILE_SIZE,
  });

  const filteredAndSortedPdfs = useMemo(() => {
    return pdfs
      .filter(pdf => {
        if (!pdf) return false;
        const pdfTitle = (pdf as any)?.title || (pdf as any)?.name || '';
        const safeSearchQuery = searchQuery || '';
        const matchesSearch = pdfTitle.toLowerCase().includes(safeSearchQuery.toLowerCase());
        const matchesFilter = filterType === 'all'
          ? true
          : filterType === 'with-mcqs'
            ? (pdf.mcqs?.length || 0) > 0
            : !(pdf.mcqs?.length || 0);
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'name':
            return a.title.localeCompare(b.title);
          case 'size':
            return b.fileSize - a.fileSize;
          default:
            return 0;
        }
      });
  }, [pdfs, searchQuery, filterType, sortBy]);

  // console.log(isUploading, currentFiles, uploadProgress, mcqs, showMcqs, pdfs, isLoading);
  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <input {...getInputProps()} />
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100]"
            >
              <Loading />
            </motion.div>
          )}
        </AnimatePresence>
        {isUploading === true ? (
          <div>
            <p>Uploading {currentFiles.length} files</p>
            <Progress value={uploadProgress} />
            <p>{Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <div>
            <p>
              {isDragActive ? 'Drop the PDFs here' : 'Drag & drop PDFs or click to upload'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Max file size: {MAX_FILE_SIZE / (1024 * 1024)}MB per file
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search PDFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(value: 'all' | 'with-mcqs' | 'without-mcqs') => setFilterType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PDFs</SelectItem>
                <SelectItem value="with-mcqs">With MCQs</SelectItem>
                <SelectItem value="without-mcqs">Without MCQs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'size') => setSortBy(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Uploaded PDFs</h2>
          {isLoading ? (
            <Loading />
          ) : (
            <div className="space-y-4">
              {filteredAndSortedPdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="border rounded-lg p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium truncate">
                        {Truncate(pdf.title, 30)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Size: {pdf.fileSize ? (pdf.fileSize / (1024 * 1024)).toFixed(2) + 'MB' : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Pages: {pdf.pageCount || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Uploaded: {pdf.createdAt ? new Date(pdf.createdAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                      <p className="text-sm text-gray-500">
                        MCQs: {pdf.mcqs?.length || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPdfs.includes(pdf.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPdfs([...selectedPdfs, pdf.id]);
                          } else {
                            setSelectedPdfs(selectedPdfs.filter(id => id !== pdf.id));
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartTest('pdf', [pdf.id])}
                        disabled={!pdf.mcqs?.length}
                      >
                        Take Test
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAndSortedPdfs.length === 0 && (
                <p className="text-center text-gray-500">No PDFs found matching your criteria</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {selectedPdfs.length > 0 && (
            <Button
              onClick={() => handleStartTest('pdf', selectedPdfs)}
              className="w-full"
            >
              {selectedPdfs.length === 1 ? 'Take PDF Test' : `Take Combined Test (${selectedPdfs.length} PDFs)`}
            </Button>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => ShowModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-lg font-semibold mb-4">Generate MCQs</h2>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleUploadWithForm();
                ShowModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block mb-1 font-medium" htmlFor="num-questions">
                  Number of Questions (max 50)
                </label>
                <Input
                  id="num-questions"
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  min={1}
                  max={50}
                  required
                />
              </div>
              <div>
                <label className="block mb-1 font-medium" htmlFor="domain-topic">
                  Domain / Topic
                </label>
                <Input
                  id="domain-topic"
                  type="text"
                  value={domainTopic}
                  placeholder="Enter or select a topic"
                  onChange={(e) => setDomainTopic(e.target.value)}
                  list="ai-suggested-domains"
                  required
                />

              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => ShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Generate</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* {showMcqs && mcqs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Generated MCQs</h2>
          <div className="space-y-6">
            {mcqs.map((mcq, idx) => (
              <div key={idx} className="border rounded p-4">
                <p className="font-medium">{mcq.question}</p>
                <ul className="mt-2 space-y-2">
                  {mcq.options.map((opt, i) => (
                    <li
                      key={i}
                      className={`p-2 rounded ${
                        i === mcq.correctAnswer ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-600 mt-2">
                  Explanation: {mcq.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )} */}
    </div>
  );
}
