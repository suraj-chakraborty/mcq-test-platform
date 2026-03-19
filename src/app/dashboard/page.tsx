'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PdfUpload from '@/app/components/PdfUpload';
import PdfList from '@/app/components/PdfList';
import { Toaster } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
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
import Loading from '../loading';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';
import { Skeleton, TestCardSkeleton, StatsSkeleton } from '@/app/components/Skeleton';

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

interface TestAttempt {
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
  const [userStats, setUserStats] = useState<{
    level: number;
    streak: number;
    xp: number;
    xpInCurrentLevel: number;
    xpNeededForNextLevel: number;
  } | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/users/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserStats({
            level: data.user.level,
            streak: data.user.streak,
            xp: data.user.xp,
            xpInCurrentLevel: data.user.xpInCurrentLevel,
            xpNeededForNextLevel: data.user.xpNeededForNextLevel,
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
        body: JSON.stringify({ testId })
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
    pyqPDF: []
  });

  const [showResults, setShowResults] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [testAttempts, setTestAttempts] = useState<TestAttempt[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      setIsLoading(false);
    }
  }, [status, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'context' | 'pyq') => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        [type === 'context' ? 'contextPDF' : 'pyqPDF']: files
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

  const startPredefinedTest = async (type: 'current-affairs' | 'general-knowledge') => {
    try {
      const response = await fetch('/api/tests/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error('Failed to start test');
      }

      const data = await response.json();
      router.push(`/take-test/${data.testId}`);
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  };

  const filteredAndSortedTests = useMemo(() => {
    return tests
      .filter(test =>
        test.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
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
    setDisplayCount(prev => prev + 6);
    if (displayCount + 6 >= filteredAndSortedTests.length) {
      setAllTestsLoaded(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('domainTopic', formData.domainTopic);
    formDataToSend.append('numQuestions', formData.numQuestions.toString());

    if (formData.contextPDF) {
      formData.contextPDF.forEach((file) => {
        formDataToSend.append('contextPDF', file);
      });
    }
    if (formData.pyqPDF) {
      formData.pyqPDF.forEach((file) => {
        formDataToSend.append('pyqPDF', file);
      });
    }

    try {
      const response = await fetch('/api/pdf-tests/create', {
        method: 'POST',
        body: formDataToSend,
      });

      const textResponse = await response.text();
      try {
        const data = JSON.parse(textResponse);
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
      } catch (jsonError) {
        toast.error('Failed to parse server response');
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
          {[1, 2, 3, 4, 5, 6].map((i) => <TestCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const handleCreateBattle = async (testId: string) => {
    try {
      const res = await fetch('/api/duels/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId })
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
        body: JSON.stringify({ roomCode: code.toUpperCase() })
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
    return <TestAttempt test={selectedTest} onComplete={handleTestComplete} />;
  }

  if (showResults && currentResults) {
    return <TestResults results={currentResults} onClose={handleCloseResults} />;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 font-medium text-sm sm:text-base">Manage your learning journey</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex flex-wrap items-center gap-4 sm:gap-6 bg-white p-2 pr-4 sm:pr-6 rounded-[2rem] sm:rounded-full shadow-xl shadow-gray-100/50 border border-gray-100 w-full lg:w-auto"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full border border-amber-100 text-amber-700 font-black text-sm whitespace-nowrap">
            <span>🔥</span>
            <span>{userStats?.streak || 0} Day Streak</span>
          </div>
          
          <div className="hidden sm:flex flex-col gap-1 w-24">
             <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-indigo-400">
               <span>LVL {userStats?.level || 1}</span>
               <span>{Math.floor(((userStats?.xpInCurrentLevel || 0) / (userStats?.xpNeededForNextLevel || 100)) * 100)}%</span>
             </div>
             <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((userStats?.xpInCurrentLevel || 0) / (userStats?.xpNeededForNextLevel || 100)) * 100}%` }}
                  className="h-full bg-indigo-500"
                />
             </div>
          </div>

          <div className="flex items-center gap-3 ml-auto sm:ml-0 border-l border-gray-100 pl-4 sm:border-none sm:pl-0">
            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100 flex-shrink-0">
              {session?.user?.name?.[0] || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rank: Challenger</span>
              <button onClick={() => setIsProfileModalOpen(true)} className="text-gray-900 font-bold hover:text-indigo-600 transition-colors whitespace-nowrap text-sm">
                {session?.user?.name || 'User'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <Tabs defaultValue="current_affair" className="w-full">
        <TabsList className="bg-gray-100/50 p-1 rounded-xl mb-8 flex justify-start sm:justify-center overflow-x-auto gap-1 no-scrollbar">
          <TabsTrigger value="current_affair" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6">Normal Test</TabsTrigger>
          <TabsTrigger value="study" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6 flex items-center gap-2">
            Study
            {dueFlashcards.length > 0 && (
              <span className="bg-red-500 text-white text-[8px] h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
                {dueFlashcards.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pdf" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6">PDF Management</TabsTrigger>
          <TabsTrigger value="pyq-pdf" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6">PYQ Based</TabsTrigger>
          <TabsTrigger value="descriptive" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm px-6">Descriptive</TabsTrigger>
        </TabsList>

        <TabsContent value="study" className="space-y-8">
           {isStudying ? (
             <FlashcardDeck 
               cards={dueFlashcards} 
               onComplete={() => {
                 setIsStudying(false);
                 fetchDueCards();
               }} 
             />
           ) : (
             <div className="max-w-xl mx-auto py-12 text-center">
                <div className="h-32 w-32 bg-indigo-50 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                   <Brain className="h-16 w-16 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Active Recall Lab</h2>
                <p className="text-gray-500 font-medium mb-10 max-w-sm mx-auto">
                  {dueFlashcards.length > 0 
                    ? `You have ${dueFlashcards.length} cards due for review. Let's strengthen those neural pathways!`
                    : "Your brain is well-rested! No cards due for review. Create new decks from your tests below."}
                </p>
                {dueFlashcards.length > 0 && (
                  <Button 
                    className="h-16 px-12 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black shadow-2xl shadow-indigo-100 mb-8"
                    onClick={() => setIsStudying(true)}
                  >
                    START STUDY SESSION
                  </Button>
                )}
                
                <div className="grid grid-cols-1 gap-4 text-left">
                   <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-start gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">⚡</div>
                      <div>
                         <h4 className="font-bold text-gray-900">How it works</h4>
                         <p className="text-sm text-gray-500">We use the SM-2 algorithm to show you difficult questions more often, ensuring you never forget what you've learned.</p>
                      </div>
                   </div>
                </div>
             </div>
           )}
        </TabsContent>

        <TabsContent value="current_affair" className="space-y-8">
          <div className="flex flex-col xl:flex-row justify-between items-stretch lg:items-center gap-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-row lg:flex-wrap gap-3 w-full xl:w-auto">
              <Button variant="outline" className="rounded-2xl h-12 px-4 font-bold border-gray-100 flex-1 lg:flex-none" onClick={() => startPredefinedTest('current-affairs')}>Current Affairs</Button>
              <Button variant="outline" className="rounded-2xl h-12 px-4 font-bold border-gray-100 flex-1 lg:flex-none" onClick={() => startPredefinedTest('general-knowledge')}>General Knowledge</Button>
              <Button variant="outline" className="rounded-2xl h-12 px-4 font-bold text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 flex-1 lg:flex-none" onClick={handleJoinBattle}>Join Battle ⚔️</Button>
              <Button variant="outline" className="rounded-2xl h-12 px-4 font-bold text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 flex-1 lg:flex-none" onClick={() => setIsMathModalOpen(true)}>Scan Math 📸</Button>
              <Button className="rounded-2xl h-12 px-6 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 col-span-2 md:col-span-1 lg:flex-none" onClick={() => router.push('/create-test')}>Create Custom Test</Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:max-w-md">
              <Input placeholder="Search your tests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 rounded-2xl h-12 bg-white border-gray-100 shadow-sm" />
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'date' | 'name' | 'questions')}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-2xl h-12 bg-white border-gray-100 shadow-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Latest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="questions">Question Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => <TestCardSkeleton key={i} />)}
              </div>
            ) : displayedTests.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {displayedTests.map((test, index) => (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="flex flex-col justify-between h-full hover:shadow-2xl transition-all duration-300 border-none bg-white shadow-xl shadow-gray-100/50 group overflow-hidden">
                      <div className="h-2 bg-indigo-500 w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardHeader className="pb-2">
                        <CardTitle className="flex justify-between items-start gap-4">
                          <span className="truncate text-xl font-black text-gray-900">{test.title}</span>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Share"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/take-test/${test.id}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Link copied!');
                              }}
                            >
                              🔗
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Start Battle"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateBattle(test.id);
                              }}
                            >
                              ⚔️
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-amber-600 hover:bg-amber-50 rounded-lg"
                              title="Leaderboard"
                              onClick={() => router.push(`/leaderboard/${test.id}`)}
                            >
                              🏆
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              title="Create Flashcards"
                              onClick={(e) => {
                                e.stopPropagation();
                                createFlashcards(test.id);
                              }}
                            >
                              🎴
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 pt-0">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">⏱️ {test.duration}m</span>
                          <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">📝 {test.questions.length} Qs</span>
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 min-h-[3rem] font-medium">{test.description || 'No description provided.'}</p>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <Button variant="outline" className="w-full rounded-xl font-bold border-gray-100 text-gray-600" onClick={() => router.push(`/edit-test/${test.id}`)}>Edit</Button>
                          <Button variant="ghost" className="w-full rounded-xl font-bold text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(test.id)}>Delete</Button>
                        </div>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-black text-base shadow-lg shadow-indigo-100 group/btn" onClick={() => router.push(`/take-test/${test.id}`)}>
                          Take Test <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="col-span-full text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500 font-bold">No tests found matching your criteria.</p>
              </div>
            )}

            {!allTestsLoaded && filteredAndSortedTests.length > 6 && (
              <div className="col-span-full text-center mt-8">
                <Button variant="outline" className="px-10 rounded-full font-bold h-12" onClick={loadMore}>Load More Results</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pdf">
          <div className="space-y-12">
            <section className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">PDF Management</h2>
                  <p className="text-gray-500 font-medium text-sm">Upload documents to generate tests using AI</p>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 px-8 rounded-xl font-bold" onClick={() => router.push('/create-test')}>Generate from AI</Button>
              </div>
              <PdfUpload />
            </section>
            <section>
              <PdfList />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="descriptive">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100">
            <DescriptivePage />
          </div>
        </TabsContent>

        <TabsContent value="pyq-pdf">
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900">PYQ Based Tests</h2>
                <p className="text-gray-500 font-medium text-sm">Tests generated from Previous Year Questions</p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 px-8 rounded-xl font-bold h-12" onClick={() => setShowCreateForm(true)}>New PYQ Test</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pdfTests.length > 0 ? (
                pdfTests.map((test) => (
                  <Card key={test.id} className="border-none shadow-xl shadow-gray-100 bg-white rounded-2xl overflow-hidden group">
                    <CardHeader className="bg-indigo-50/50">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-lg font-black text-gray-900 line-clamp-1">{test.title}</CardTitle>
                        <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-indigo-600 border border-indigo-100 shadow-sm">PYQ</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <p className="text-gray-500 text-sm font-medium line-clamp-2">{test.description}</p>
                      <div className="grid grid-cols-1 gap-2">
                        <Button className="w-full bg-gray-900 hover:bg-black rounded-xl font-black h-12" onClick={() => router.push(`/pdf-tests/${test.id}/attempt`)}>Attempt Now</Button>
                        <div className="grid grid-cols-3 gap-2">
                          <Button variant="outline" className="rounded-xl font-bold h-10 text-xs px-2" onClick={() => setViewTest(viewTest?.id === test.id ? null : test)}>View</Button>
                          <Button variant="outline" className="rounded-xl font-bold h-10 text-xs px-2" onClick={() => setEditingTest(test)}>Edit</Button>
                          <Button variant="ghost" className="rounded-xl font-bold h-10 text-xs px-2 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setTestToDelete(test)}>Delete</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500 font-bold">No PYQ tests created yet.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* View PDF Test Modal Content */}
      <Dialog open={!!viewTest} onOpenChange={() => setViewTest(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-3xl">
          <DialogTitle className="text-2xl font-black pb-4 border-b">Test Preview: {viewTest?.title}</DialogTitle>
          <div className="space-y-6 py-6 font-medium">
            {viewTest?.questions?.map((q, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <p className="font-black text-gray-900 mb-4">Q{idx + 1}: {q.question}</p>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  {q.options.map((opt, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${i === q.correctAnswer ? 'bg-green-100 border-green-200 text-green-800' : 'bg-white border-gray-200 text-gray-600'}`}>
                      {opt}
                    </div>
                  ))}
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Explanation</div>
                <p className="text-sm text-gray-600 mt-1">{q.explanation}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Test Dialog - simplified for standard use */}
      <Dialog open={!!editingTest} onOpenChange={() => setEditingTest(null)}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-black">Edit Test Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             <p className="text-gray-500 font-medium">Coming soon: Full inline question editing. Use the standard Edit button for now.</p>
             <Button className="w-full bg-indigo-600" onClick={() => {
               if(editingTest) router.push(`/edit-test/${editingTest.id}`);
             }}>Go to Editor</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create form modal */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-black">New PYQ Test</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Title</label>
              <Input value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} className="rounded-xl h-12" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Context PDF (Reference Material)</label>
              <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(e, 'context')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">PYQ PDF (Previous Questions)</label>
              <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(e, 'pyq')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-amber-50 file:text-amber-600 hover:file:bg-amber-100 cursor-pointer" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 rounded-xl font-bold px-8" disabled={isLoading}>{isLoading ? 'Generating...' : 'Start Generation'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Delete Permanently?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">This will remove this test and all associated attempt data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Nevermind</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700 font-bold" onClick={handleDeleteTest}>Confirm Delete</AlertDialogAction>
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
    </div>
  );
}