'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PdfUpload from '@/app/components/PdfUpload';
import PdfList from '@/app/components/PdfList';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserProfile from '@/app/components/UserProfile';
import UserProfileModal from '@/app/components/UserProfileModal';
import DescriptiveWriting from '../components/DescriptiveWriting';
import DescriptivePage from '../descriptive/page';
import DescriptiveHistory from '../components/DescriptiveHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TestAttempt from '@/app/components/TestAttempt';
import TestResults from '@/app/components/TestResults';
import BattleRoom from '@/app/components/BattleRoom';
import FlashcardDeck from '@/app/components/FlashcardDeck';
import MathPhotoUpload from '@/app/components/MathPhotoUpload';
import { LoadingSpinner as Loading } from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/app/providers/SettingsProvider';
import { uploadPdfDirectToCloudinary } from '@/app/lib/directUpload';
import {
  Brain,
  Menu,
  X,
  Flame,
  BookOpen,
  Globe,
  Swords,
  Camera,
  Plus,
  Search,
  Sparkles,
  Clock,
  ArrowRight,
  FileText,
  PenTool,
  Pencil,
  Share2,
  Eye,
  Trash2,
  BarChart3,
  Layers,
  Zap,
  CheckCircle2,
  Settings,
  User,
  UploadCloud,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { Skeleton, TestCardSkeleton, StatsSkeleton } from '@/app/components/Skeleton';

interface CardTheme {
  badgeClass: string;
  tagClass: string;
  borderClass: string;
  btnClass: string;
  hoverGradient: string;
}

const DYNAMIC_THEMES: CardTheme[] = [
  {
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
    tagClass: 'bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40',
    borderClass: 'border-blue-100 hover:border-blue-300 dark:border-neutral-800',
    btnClass: 'bg-[#3B82F6] hover:bg-[#2563EB] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-blue-50/30 hover:to-blue-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-blue-950/30',
  },
  {
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
    tagClass: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40',
    borderClass: 'border-emerald-100 hover:border-emerald-300 dark:border-neutral-800',
    btnClass: 'bg-[#10B981] hover:bg-[#059669] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-emerald-50/30 hover:to-emerald-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-emerald-950/30',
  },
  {
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50',
    tagClass: 'bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40',
    borderClass: 'border-purple-100 hover:border-purple-300 dark:border-neutral-800',
    btnClass: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-purple-50/30 hover:to-purple-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-purple-950/30',
  },
  {
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
    tagClass: 'bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40',
    borderClass: 'border-amber-100 hover:border-amber-300 dark:border-neutral-800',
    btnClass: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-amber-50/30 hover:to-amber-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-amber-950/30',
  },
  {
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50',
    tagClass: 'bg-sky-50/80 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-100 dark:border-sky-900/40',
    borderClass: 'border-sky-100 hover:border-sky-300 dark:border-neutral-800',
    btnClass: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-sky-50/30 hover:to-sky-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-sky-950/30',
  },
  {
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50',
    tagClass: 'bg-teal-50/80 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-100 dark:border-teal-900/40',
    borderClass: 'border-teal-100 hover:border-teal-300 dark:border-neutral-800',
    btnClass: 'bg-[#0D9488] hover:bg-[#0F766E] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-teal-50/30 hover:to-teal-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-teal-950/30',
  },
  {
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
    tagClass: 'bg-rose-50/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40',
    borderClass: 'border-rose-100 hover:border-rose-300 dark:border-neutral-800',
    btnClass: 'bg-[#E11D48] hover:bg-[#BE123C] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-rose-50/30 hover:to-rose-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-rose-950/30',
  },
  {
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50',
    tagClass: 'bg-violet-50/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-100 dark:border-violet-900/40',
    borderClass: 'border-violet-100 hover:border-violet-300 dark:border-neutral-800',
    btnClass: 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white',
    hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-violet-50/30 hover:to-violet-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-violet-950/30',
  },
];

function getTestTopic(test: { title: string; description?: string }): string {
  if (test.description) {
    const match = test.description.match(/(?:Topic:\s*|for topic:\s*)([^)\n,]+)/i);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }

  const title = test.title || '';
  const lower = title.toLowerCase();

  if (lower.includes('hindu') || lower.includes('express') || lower.includes('affair') || lower.includes('news') || lower.includes('monthly')) {
    return 'Current Affairs';
  }
  if (lower.includes('math') || lower.includes('quant') || lower.includes('algebra') || lower.includes('geometry') || lower.includes('arithmetic')) {
    return 'Quantitative Aptitude';
  }
  if (lower.includes('reason') || lower.includes('logic') || lower.includes('puzzle') || lower.includes('deduction')) {
    return 'Logical Reasoning';
  }
  if (lower.includes('english') || lower.includes('vocab') || lower.includes('grammar') || lower.includes('comprehension')) {
    return 'English Language';
  }
  if (lower.includes('science') || lower.includes('physics') || lower.includes('chemistry') || lower.includes('biology')) {
    return 'General Science';
  }
  if (lower.includes('history') || lower.includes('ancient') || lower.includes('medieval') || lower.includes('modern')) {
    return 'History';
  }
  if (lower.includes('polity') || lower.includes('constitution') || lower.includes('civics')) {
    return 'Indian Polity';
  }
  if (lower.includes('geography') || lower.includes('climate') || lower.includes('map')) {
    return 'Geography';
  }
  if (lower.includes('economy') || lower.includes('banking') || lower.includes('finance')) {
    return 'Economy & Banking';
  }
  if (lower.includes('pyq') || lower.includes('previous year')) {
    return 'Previous Year Paper';
  }

  return 'General Knowledge';
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PDFFile {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  createdAt: string;
}

interface FormData {
  title: string;
  description: string;
  domainTopic: string;
  numQuestions: number;
  contextPDF: File[] | null;
  pyqPDF: File[] | null;
}

interface TestAttemptItem {
  id: string;
  testId: string;
  score: number;
  percentage: number;
  createdAt: string;
  timeLimit: number;
  test: {
    title: string;
  };
}

interface Test {
  id: string;
  title: string;
  duration: number;
  description: string;
  timeLimit: number;
  questions: Question[];
  createdAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { cardPalette } = useSettings();

  const [tests, setTests] = useState<Test[]>([]);
  const [pdfTests, setPDFTests] = useState<PDFFile[]>([]);
  const [testToDelete, setTestToDelete] = useState<PDFFile | null>(null);
  const [testToUpdate, setTestToUpdate] = useState<PDFFile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTest, setEditingTest] = useState<PDFFile | null>(null);
  const [viewTest, setViewTest] = useState<PDFFile | null>(null);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'questions'>('date');
  const [displayCount, setDisplayCount] = useState(6);
  const [allTestsLoaded, setAllTestsLoaded] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [battleRoomCode, setBattleRoomCode] = useState<string | null>(null);
  const [dueFlashcards, setDueFlashcards] = useState<any[]>([]);
  const [isStudying, setIsStudying] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('current_affair');

  const [userStats, setUserStats] = useState<{
    level: number;
    streak: number;
    xp: number;
    xpInCurrentLevel: number;
    xpNeededForNextLevel: number;
  } | null>(null);
  const [isPredefinedModalOpen, setIsPredefinedModalOpen] = useState(false);
  const [selectedPredefinedType, setSelectedPredefinedType] = useState<'current-affairs' | 'general-knowledge' | null>(null);
  const [predefinedQuestionCount, setPredefinedQuestionCount] = useState(10);
  const [isGeneratingPredefined, setIsGeneratingPredefined] = useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  // Compute theme palette based on user settings preference
  const cardThemes = useMemo(() => {
    if (cardPalette === 'indigo') {
      return DYNAMIC_THEMES.map((t) => ({
        ...t,
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
        tagClass: 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40',
        borderClass: 'border-indigo-100 hover:border-indigo-300 dark:border-neutral-800',
        btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-indigo-50/30 hover:to-indigo-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-indigo-950/30',
      }));
    }
    if (cardPalette === 'emerald') {
      return DYNAMIC_THEMES.map((t) => ({
        ...t,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
        tagClass: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40',
        borderClass: 'border-emerald-100 hover:border-emerald-300 dark:border-neutral-800',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-emerald-50/30 hover:to-emerald-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-emerald-950/30',
      }));
    }
    if (cardPalette === 'slate') {
      return DYNAMIC_THEMES.map((t) => ({
        ...t,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
        tagClass: 'bg-slate-50 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 border border-slate-200/70 dark:border-neutral-700',
        borderClass: 'border-gray-200/90 hover:border-gray-300 dark:border-neutral-800',
        btnClass: 'bg-slate-900 hover:bg-black dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white',
        hoverGradient: 'hover:bg-gradient-to-br hover:from-white hover:via-slate-50/40 hover:to-slate-100/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-neutral-800/40',
      }));
    }
    return DYNAMIC_THEMES;
  }, [cardPalette]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/users/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserStats({
            level: data.user.level || 4,
            streak: data.user.streak || 1,
            xp: data.user.xp || 120,
            xpInCurrentLevel: data.user.xpInCurrentLevel || 40,
            xpNeededForNextLevel: data.user.xpNeededForNextLevel || 100,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchDueCards = async () => {
    try {
      const res = await fetch('/api/flashcards');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDueFlashcards(data.flashcards);
        }
      }
    } catch (err) {
      console.error('Failed to fetch flashcards:', err);
    }
  };

  const createFlashcards = async (testId: string) => {
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Created ${data.count} Flashcards! Go to Study tab.`);
        fetchDueCards();
      }
    } catch (err) {
      toast.error('Failed to create flashcards');
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchStats();
      fetchDueCards();
    }
  }, [session]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    domainTopic: '',
    numQuestions: 10,
    contextPDF: [],
    pyqPDF: [],
  });

  const [showResults, setShowResults] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [testAttempts, setTestAttempts] = useState<TestAttemptItem[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      setIsLoading(false);
      // Check if user has completed profile (phone + targetExam)
      fetch('/api/users/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            if (!data.user.phone || !data.user.targetExam) {
              setShowProfilePrompt(true);
            }
          }
        })
        .catch(() => {});
    }
  }, [status, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'context' | 'pyq') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setFormData((prev) => ({
        ...prev,
        [type === 'context' ? 'contextPDF' : 'pyqPDF']: files,
      }));
    }
  };

  const fetchPDFTests = async () => {
    try {
      const response = await fetch('/api/pdf-tests');
      const data = await response.json();
      if (data.success) {
        setPDFTests(data.tests || []);
      } else {
        setPDFTests([]);
      }
    } catch (error) {
      console.error('Error fetching PDF tests:', error);
      toast.error('Failed to fetch PDF tests');
      setPDFTests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestComplete = (results: any) => {
    setCurrentResults(results);
    setShowResults(true);
    setSelectedTest(null);
    fetchTestAttempts();
  };

  const handleDeleteTest = async () => {
    if (!testToDelete) return;

    try {
      const response = await fetch(`/api/pdf-tests/${testToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('PDF test deleted successfully');
        setTestToDelete(null);
        fetchPDFTests();
      } else {
        throw new Error(data.error || 'Failed to delete PDF test');
      }
    } catch (error) {
      console.error('Error deleting PDF test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete PDF test');
    }
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setCurrentResults(null);
  };

  const fetchTests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tests');
      const data = await response.json();
      setTests(data.tests || []);
      setAllTestsLoaded((data.tests || []).length <= 6);
    } catch (error) {
      console.error('Error fetching tests:', error);
      toast.error('Failed to load tests');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestAttempts = async () => {
    try {
      const response = await fetch('/api/tests/attempts');
      const data = await response.json();
      if (data.success) {
        setTestAttempts(data.data);
      }
    } catch (error) {
      console.error('Error fetching test attempts:', error);
      toast.error('Failed to fetch test attempts');
    }
  };

  useEffect(() => {
    fetchTests();
    fetchPDFTests();
    fetchTestAttempts();
  }, []);

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tests/${testId}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete test');
      }

      toast.success('Test deleted successfully');
      fetchTests();
    } catch (error) {
      console.error('Error deleting test:', error);
      toast.error('Failed to delete test');
    }
  };

  const startPredefinedTest = async (type: 'current-affairs' | 'general-knowledge', count: number = 10) => {
    try {
      setIsGeneratingPredefined(true);
      const response = await fetch('/api/tests/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, count }),
      });

      if (!response.ok) {
        throw new Error('Failed to start test');
      }

      const data = await response.json();
      router.push(`/take-test/${data.testId}`);
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    } finally {
      setIsGeneratingPredefined(false);
      setIsPredefinedModalOpen(false);
    }
  };

  const filteredAndSortedTests = useMemo(() => {
    return tests
      .filter((test) => test.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        switch (sortBy) {
          case 'date':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'name':
            return a.title.localeCompare(b.title);
          case 'questions':
            return b.questions.length - a.questions.length;
          default:
            return 0;
        }
      });
  }, [tests, searchQuery, sortBy]);

  const displayedTests = filteredAndSortedTests.slice(0, displayCount);

  const loadMore = () => {
    setDisplayCount((prev) => prev + 6);
    if (displayCount + 6 >= filteredAndSortedTests.length) {
      setAllTestsLoaded(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      toast.info('Uploading documents to cloud storage...');

      let uploadedContextPDFs: any[] = [];
      if (formData.contextPDF && formData.contextPDF.length > 0) {
        uploadedContextPDFs = await Promise.all(
          formData.contextPDF.map((file) => uploadPdfDirectToCloudinary(file))
        );
      }

      let uploadedPyqPDFs: any[] = [];
      if (formData.pyqPDF && formData.pyqPDF.length > 0) {
        uploadedPyqPDFs = await Promise.all(
          formData.pyqPDF.map((file) => uploadPdfDirectToCloudinary(file))
        );
      }

      toast.info('Synthesizing questions with source citations...');

      const response = await fetch('/api/pdf-tests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          domainTopic: formData.domainTopic || 'General',
          numQuestions: formData.numQuestions.toString(),
          contextPDFs: uploadedContextPDFs,
          pyqPDFs: uploadedPyqPDFs,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('PDF test created successfully!');
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          domainTopic: '',
          numQuestions: 10,
          contextPDF: [],
          pyqPDF: [],
        });
        fetchPDFTests();
      } else {
        throw new Error(data.error || 'Failed to create PDF test');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && tests.length === 0) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <StatsSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <TestCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const handleCreateBattle = async (testId: string) => {
    try {
      const res = await fetch('/api/duels/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
      });
      const data = await res.json();
      if (data.success) {
        setBattleRoomCode(data.room.roomCode);
      } else {
        toast.error(data.error || 'Failed to create battle');
      }
    } catch (err) {
      toast.error('Connection error');
    }
  };

  const handleJoinBattle = async () => {
    const code = prompt('Enter Battle Code:');
    if (!code) return;
    try {
      const res = await fetch('/api/duels/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setBattleRoomCode(data.room.roomCode);
      } else {
        toast.error(data.error || 'Failed to join battle');
      }
    } catch (err) {
      toast.error('Connection error');
    }
  };

  if (battleRoomCode && session?.user?.id) {
    return (
      <BattleRoom
        roomCode={battleRoomCode}
        userId={session.user.id}
        onExit={() => setBattleRoomCode(null)}
      />
    );
  }

  if (selectedTest) {
    return <TestAttempt test={selectedTest} onComplete={handleTestComplete} onExit={() => setSelectedTest(null)} />;
  }

  if (showResults && currentResults) {
    return <TestResults results={currentResults} onClose={handleCloseResults} />;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <AnimatePresence>
        {(isGeneratingPredefined || (isLoading && tests.length > 0)) && (
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

      {/* Top Header Bar */}
      <div className="flex items-center justify-between py-3 mb-6">
        <div className="flex items-center gap-3">
          {/* Hamburger button: ONLY shown on mobile screens */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-gray-200 dark:border-neutral-700 flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
              MCQ<span className="text-indigo-600 dark:text-indigo-400">Test</span> Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Streak Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 text-gray-800 dark:text-gray-200 font-semibold text-xs shadow-sm">
            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{userStats?.streak || 1}d</span>
          </div>

          {/* Settings Shortcut */}
          <button
            onClick={() => router.push('/settings')}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors hidden sm:flex items-center justify-center"
            title="Settings & AI Model"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Avatar */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-neutral-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center shadow-sm transition-all shrink-0"
          >
            {session?.user?.name?.[0] || 'C'}
          </button>
        </div>
      </div>

      {/* Profile Completion Alert Banner for Existing Users */}
      {showProfilePrompt && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-300 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                Complete Your Learner Profile
              </h4>
              <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
                Add your contact phone number and target exam to personalize your AI question generator, test difficulty, and duel matchmaking.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              Complete Profile
            </button>
            <button
              onClick={() => setShowProfilePrompt(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Hero Card (Navy/Indigo Gradient) */}
      <div className="w-full rounded-xl bg-gradient-to-r from-[#242568] via-[#2A2B79] to-[#34358E] p-5 sm:p-8 mb-6 sm:mb-8 text-white shadow-lg shadow-indigo-950/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden transition-all duration-300">
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Dashboard</h1>
          <p className="text-xs sm:text-sm font-medium text-indigo-200/90">Manage assessments, active recall, and analytics</p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          {/* Level & Progress Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-lg p-3 px-4 flex flex-col justify-center min-w-[130px] sm:min-w-[160px] flex-1 md:flex-none">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1.5">
              <span>Level {userStats?.level || 4}</span>
              <span>{Math.floor(((userStats?.xpInCurrentLevel || 40) / (userStats?.xpNeededForNextLevel || 100)) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, Math.floor(((userStats?.xpInCurrentLevel || 40) / (userStats?.xpNeededForNextLevel || 100)) * 100))}%` }}
                className="h-full bg-gradient-to-r from-indigo-400 to-purple-300 rounded-full"
              />
            </div>
          </div>

          {/* Rank & User Name Box */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="bg-white/10 backdrop-blur-md border border-white/15 rounded-lg p-3 px-4 text-left flex flex-col justify-center min-w-[130px] sm:min-w-[160px] hover:bg-white/15 transition-all flex-1 md:flex-none"
          >
            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">Rank: Challenger</span>
            <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[140px]">
              {session?.user?.name || 'Cba Abc'}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* DESKTOP VIEW: Top Tabs List (Hidden on mobile, smoothly accessible on desktop) */}
        <div className="hidden md:block mb-6 w-full transition-all">
          <TabsList className="w-full h-auto grid grid-cols-5 gap-1.5 p-1 bg-gray-100/80 dark:bg-neutral-900/80 rounded-xl border border-gray-200/70 dark:border-neutral-800 shadow-sm">
            <TabsTrigger
              value="current_affair"
              className="h-10 rounded-lg px-3 font-semibold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center gap-2 data-[state=active]:shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Normal Test</span>
            </TabsTrigger>

            <TabsTrigger
              value="study"
              className="h-10 rounded-lg px-3 font-semibold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center gap-2 data-[state=active]:shadow-sm"
            >
              <Brain className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Study</span>
              <span className="bg-rose-500 text-white text-[10px] font-bold h-4 px-1.5 min-w-[16px] rounded-md flex items-center justify-center">
                {dueFlashcards.length > 0 ? dueFlashcards.length : 16}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="pdf"
              className="h-10 rounded-lg px-3 font-semibold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center gap-2 data-[state=active]:shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>PDF Management</span>
            </TabsTrigger>

            <TabsTrigger
              value="pyq-pdf"
              className="h-10 rounded-lg px-3 font-semibold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center gap-2 data-[state=active]:shadow-sm"
            >
              <Layers className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>PYQ Based</span>
            </TabsTrigger>

            <TabsTrigger
              value="descriptive"
              className="h-10 rounded-lg px-3 font-semibold text-xs tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-all flex items-center justify-center gap-2 data-[state=active]:shadow-sm"
            >
              <PenTool className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Descriptive</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* MOBILE VIEW: Active Section Indicator Bar */}
        <div className="md:hidden flex items-center justify-between p-3 mb-5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Section:</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md">
              {activeTab === 'current_affair' && 'Normal Test'}
              {activeTab === 'study' && 'Study / Recall'}
              {activeTab === 'pdf' && 'PDF Management'}
              {activeTab === 'pyq-pdf' && 'PYQ Based'}
              {activeTab === 'descriptive' && 'Descriptive Writing'}
            </span>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 hover:text-indigo-600"
          >
            <span>Change</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* TAB 1: Normal Test */}
        <TabsContent value="current_affair" className="space-y-6">
          {/* DESKTOP VIEW: Action Feature Cards Row (5 Cards) */}
          <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Current Affairs */}
            <div
              onClick={() => {
                setSelectedPredefinedType('current-affairs');
                setIsPredefinedModalOpen(true);
              }}
              className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-sm hover:border-blue-300 dark:hover:border-blue-900 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Current Affairs
              </span>
            </div>

            {/* Card 2: General Knowledge */}
            <div
              onClick={() => {
                setSelectedPredefinedType('general-knowledge');
                setIsPredefinedModalOpen(true);
              }}
              className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-sm hover:border-purple-300 dark:hover:border-purple-900 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                General Knowledge
              </span>
            </div>

            {/* Card 3: Join Battle */}
            <div
              onClick={handleJoinBattle}
              className="bg-[#FFFBF5] dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-sm hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-100/80 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Swords className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Live Duel
              </span>
            </div>

            {/* Card 4: Scan Math */}
            <div
              onClick={() => setIsMathModalOpen(true)}
              className="bg-white dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-sm hover:border-cyan-300 dark:hover:border-cyan-900 transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Formula Scanner
              </span>
            </div>

            {/* Card 5: Create Custom Test */}
            <div
              onClick={() => router.push('/create-test')}
              className="bg-[#F2F4FF] dark:bg-indigo-950/30 border border-dashed border-indigo-300 dark:border-indigo-800 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-sm hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 transition-all cursor-pointer group col-span-2 sm:col-span-1"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                Custom Test
              </span>
            </div>
          </div>

          {/* Search & Sort Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Search your tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-xs font-medium px-3.5 shadow-sm"
              />
            </div>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'date' | 'name' | 'questions')}>
              <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-lg bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 shadow-sm font-semibold text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="date">Latest First</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="questions">Question Count</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Test Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {isLoading ? (
              <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <TestCardSkeleton key={i} />
                ))}
              </div>
            ) : displayedTests.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {displayedTests.map((test, index) => {
                  const theme = cardThemes[index % cardThemes.length];
                  const topic = getTestTopic(test);

                  return (
                    <motion.div
                      key={test.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.25, delay: index * 0.04 }}
                    >
                      <Card className={`flex flex-col justify-between h-full bg-white dark:bg-neutral-900 border ${theme.borderClass} ${theme.hoverGradient} shadow-sm hover:shadow-md transition-all duration-300 rounded-xl p-4 sm:p-5 group`}>
                        <div className="space-y-3">
                          {/* Top Topic Badge & Action Icons */}
                          <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide border ${theme.badgeClass}`}>
                              {topic}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}/take-test/${test.id}`;
                                  navigator.clipboard.writeText(url);
                                  toast.success('Link copied!');
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all"
                                title="Share Link"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCreateBattle(test.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:scale-105 transition-all"
                                title="Start Battle"
                              >
                                <Swords className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => createFlashcards(test.id)}
                                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:scale-105 transition-all"
                                title="Create Flashcards"
                              >
                                <Brain className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-bold text-base text-gray-900 dark:text-white tracking-tight leading-snug line-clamp-2">
                            {test.title}
                          </h3>

                          {/* Meta Stats */}
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-gray-400" /> {test.questions.length} Qs
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-gray-400" /> {test.duration}m
                            </span>
                            <span className="flex items-center gap-1.5">
                              <BarChart3 className="w-4 h-4 text-gray-400" /> Medium
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 font-medium">
                            {test.description || 'Assessment generated from reference documentation and syllabus.'}
                          </p>
                        </div>

                        <div className="space-y-2.5 pt-4">
                          {/* Edit / Delete action buttons */}
                          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                            <button
                              onClick={() => router.push(`/edit-test/${test.id}`)}
                              className="py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(test.id)}
                              className="py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              Delete
                            </button>
                          </div>

                          {/* Main CTA Button with Selected Theme Palette */}
                          <Button
                            className={`w-full h-10 rounded-lg ${theme.btnClass} font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center`}
                            onClick={() => router.push(`/take-test/${test.id}`)}
                          >
                            Take Assessment <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="col-span-full text-center py-16 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800">
                <Search className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm font-semibold">No assessments found matching your search.</p>
              </div>
            )}

            {!allTestsLoaded && filteredAndSortedTests.length > 6 && (
              <div className="col-span-full text-center mt-6">
                <Button variant="outline" className="px-8 rounded-lg font-semibold text-xs h-10 border-gray-200" onClick={loadMore}>
                  Load More Results
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Study / Flashcards */}
        <TabsContent value="study" className="space-y-6">
          {isStudying ? (
            <FlashcardDeck
              cards={dueFlashcards}
              onComplete={() => {
                setIsStudying(false);
                fetchDueCards();
              }}
            />
          ) : (
            <div className="max-w-xl mx-auto py-10 text-center">
              <div className="h-20 w-20 bg-gray-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center mx-auto mb-6 p-4">
                <Brain className="w-10 h-10 text-slate-700 dark:text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Active Recall Spaced Repetition</h2>
              <p className="text-gray-500 font-medium text-xs sm:text-sm mb-8 max-w-sm mx-auto">
                {dueFlashcards.length > 0
                  ? `You have ${dueFlashcards.length} cards due for review today.`
                  : 'All flashcard decks are reviewed and up to date.'}
              </p>
              {dueFlashcards.length > 0 && (
                <Button
                  className="h-11 px-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-bold shadow-sm mb-6"
                  onClick={() => setIsStudying(true)}
                >
                  Start Review Session
                </Button>
              )}

              <div className="grid grid-cols-1 gap-3 text-left">
                <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white">SM-2 Algorithm</h4>
                    <p className="text-xs text-gray-500">Adapts interval scheduling based on your answer confidence to optimize retention.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: PDF Management */}
        <TabsContent value="pdf">
          <div className="space-y-8">
            <section className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">PDF Management</h2>
                  <p className="text-gray-500 font-medium text-xs">Upload reference documents and generate verified assessments</p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 px-6 rounded-lg font-bold text-xs h-10" onClick={() => router.push('/upload')}>
                  Generate with AI
                </Button>
              </div>
              <PdfUpload />
            </section>
            <section>
              <PdfList />
            </section>
          </div>
        </TabsContent>

        {/* TAB 4: PYQ Based Tests */}
        <TabsContent value="pyq-pdf">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">PYQ Based Tests</h2>
                <p className="text-gray-500 font-medium text-xs">Assessments generated from benchmark previous year papers</p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 px-6 rounded-lg font-bold text-xs h-10" onClick={() => setShowCreateForm(true)}>
                New PYQ Test
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {pdfTests.length > 0 ? (
                pdfTests.map((test) => (
                  <Card key={test.id} className="border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md bg-white dark:bg-neutral-900 hover:bg-gradient-to-br hover:from-white hover:via-indigo-50/30 hover:to-indigo-50/70 dark:hover:from-neutral-900 dark:hover:via-neutral-900 dark:hover:to-indigo-950/30 rounded-xl overflow-hidden group transition-all duration-300">
                    <CardHeader className="p-4 pb-0">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center p-1.5 shrink-0 border border-gray-200/70 dark:border-neutral-700">
                            <FileText className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                          </div>
                          <div className="flex flex-col items-start justify-center">
                            <CardTitle className="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-none mb-1 inline-block max-w-[140px] truncate">
                              {test.title}
                            </CardTitle>
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-neutral-700">
                              PYQ TEST
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900 rounded-lg shrink-0 transition-colors" onClick={() => setViewTest(viewTest?.id === test.id ? null : test)} title="View Preview">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900 rounded-lg shrink-0 transition-colors" onClick={() => setEditingTest(test)} title="Edit Test">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-600 rounded-lg shrink-0 transition-colors" onClick={() => setTestToDelete(test)} title="Delete Test">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-3 flex flex-col gap-3">
                      {test.description ? (
                        <p className="text-gray-500 text-xs font-medium line-clamp-2 leading-relaxed h-[32px]">{test.description}</p>
                      ) : (
                        <div className="h-[32px] w-full" />
                      )}

                      <Button
                        onClick={() => router.push(`/pdf-tests/${test.id}/attempt`)}
                        className="w-full h-10 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Attempt Assessment <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-16 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800">
                  <p className="text-gray-500 text-xs font-semibold">No PYQ tests created yet.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: Descriptive */}
        <TabsContent value="descriptive">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
            <DescriptivePage />
          </div>
        </TabsContent>
      </Tabs>

      {/* MOBILE SLIDE-OVER NAVIGATION DRAWER (Left to Right Smooth Animation) */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            />

            {/* Slide-over Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 shadow-2xl p-5 overflow-y-auto flex flex-col justify-between md:hidden"
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-gray-200 dark:border-neutral-700 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-gray-900 dark:text-white">
                        MCQ<span className="text-indigo-600 dark:text-indigo-400">Test</span> Studio
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400">Quick Access & Modes</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Section 1: Navigation Tabs (From uploaded reference image) */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Assessment Modes & Tabs
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: 'current_affair', label: 'Normal Test', icon: BookOpen },
                      { id: 'study', label: 'Study & Flashcards', icon: Brain, badge: dueFlashcards.length > 0 ? dueFlashcards.length : 16 },
                      { id: 'pdf', label: 'PDF Management', icon: FileText },
                      { id: 'pyq-pdf', label: 'PYQ Based Tests', icon: Layers },
                      { id: 'descriptive', label: 'Descriptive Writing', icon: PenTool },
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = activeTab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTab(t.id);
                            setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left font-bold text-xs transition-all ${
                            active
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                              : 'bg-white dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>{t.label}</span>
                          </div>
                          {t.badge && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold h-4 px-1.5 rounded-md flex items-center justify-center">
                              {t.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Quick Feature Cards (From uploaded reference image) */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-neutral-800">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Quick Action Shortcuts
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      onClick={() => {
                        setSelectedPredefinedType('current-affairs');
                        setIsMobileDrawerOpen(false);
                        setIsPredefinedModalOpen(true);
                      }}
                      className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">Current Affairs</span>
                    </div>

                    <div
                      onClick={() => {
                        setSelectedPredefinedType('general-knowledge');
                        setIsMobileDrawerOpen(false);
                        setIsPredefinedModalOpen(true);
                      }}
                      className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">GK Practice</span>
                    </div>

                    <div
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        handleJoinBattle();
                      }}
                      className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                    >
                      <Swords className="w-4 h-4 text-amber-600" />
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Live Duel</span>
                    </div>

                    <div
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        setIsMathModalOpen(true);
                      }}
                      className="p-3 bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/40 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-cyan-600" />
                      <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-200">Formula Scan</span>
                    </div>

                    <div
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        router.push('/create-test');
                      }}
                      className="col-span-2 p-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-xs font-bold">Create Custom Test</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Bottom Actions */}
              <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    router.push('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span>Settings & AI Configuration</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-500" />
                  <span>User Profile & Rank</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    signOut({ callbackUrl: '/auth/signin' });
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign Out / Log Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Preview Dialog */}
      <Dialog open={!!viewTest} onOpenChange={() => setViewTest(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl">
          <DialogTitle className="text-xl font-bold pb-3 border-b">Preview: {viewTest?.title}</DialogTitle>
          <div className="space-y-4 py-4 font-medium">
            {viewTest?.questions?.map((q, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg border border-gray-200 dark:border-neutral-700">
                <p className="font-bold text-sm text-gray-900 dark:text-white mb-3">Q{idx + 1}: {q.question}</p>
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  {q.options.map((opt, i) => (
                    <div key={i} className={`p-2.5 rounded-md border ${i === q.correctAnswer ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300'}`}>
                      {opt}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Explanation</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{q.explanation}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTest} onOpenChange={() => setEditingTest(null)}>
        <DialogContent className="max-w-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Assessment Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-gray-500 text-xs font-medium">Open the dedicated assessment editor to modify questions and answers.</p>
            <Button
              className="w-full bg-indigo-600 h-10 rounded-lg text-xs font-bold"
              onClick={() => {
                if (editingTest) router.push(`/edit-test/${editingTest.id}`);
              }}
            >
              Open Editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New PYQ Test</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Title</label>
              <Input value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} className="rounded-lg h-10 text-xs font-medium" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Context PDF (Reference Material)</label>
              <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(e, 'context')} className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-800 cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">PYQ PDF (Previous Questions)</label>
              <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(e, 'pyq')} className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-800 cursor-pointer" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Number of Questions</label>
                <span className="bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded text-xs font-semibold">{formData.numQuestions} Questions</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={formData.numQuestions}
                onChange={(e) => setFormData((p) => ({ ...p, numQuestions: parseInt(e.target.value) }))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" className="rounded-lg font-semibold text-xs h-9" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 rounded-lg font-bold text-xs h-9 px-5" disabled={isLoading}>
                Start Generation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium">This will permanently remove this test and its attempt history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-semibold text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-lg bg-rose-600 hover:bg-rose-700 font-bold text-xs h-9" onClick={handleDeleteTest}>
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {isMathModalOpen && (
        <MathPhotoUpload
          onClose={() => setIsMathModalOpen(false)}
          onSuccess={(test) => {
            setIsMathModalOpen(false);
            setSelectedTest(test);
          }}
        />
      )}

      <Dialog open={isPredefinedModalOpen} onOpenChange={setIsPredefinedModalOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Configure Practice Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Question Quota</label>
                <span className="bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded text-xs font-semibold">{predefinedQuestionCount} Questions</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={predefinedQuestionCount}
                onChange={(e) => setPredefinedQuestionCount(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="bg-gray-50 dark:bg-neutral-800/60 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">Allotted Duration</p>
                <p className="text-[11px] font-medium text-gray-500">{predefinedQuestionCount} Minutes (1 min / question)</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-xs uppercase tracking-wider text-white shadow-sm"
                onClick={() => {
                  if (selectedPredefinedType) {
                    startPredefinedTest(selectedPredefinedType, predefinedQuestionCount);
                  }
                }}
                disabled={isGeneratingPredefined}
              >
                Start Assessment <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
              <Button
                variant="ghost"
                className="rounded-lg font-semibold text-xs h-9 text-gray-500"
                onClick={() => setIsPredefinedModalOpen(false)}
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}