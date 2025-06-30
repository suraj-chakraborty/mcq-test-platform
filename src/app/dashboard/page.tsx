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
import Loading from '../loading';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PDFFile {
  _id: string;
  title: string;
  description: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  createdAt: string;
}

interface FormData {
  title: string;
  description: string;
  contextPDF: File[] | null;
  pyqPDF: File[] | null;
}

interface TestAttempt {
  _id: string;
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
  const [displayCount, setDisplayCount] = useState(5);
  const [allTestsLoaded, setAllTestsLoaded] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    contextPDF: [],
    pyqPDF: []
  });

  console.log("session", session, status)

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



  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'context' | 'pyq'
  ) => {
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
      console.log(data)
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
      const response = await fetch(`/api/pdf-tests/${testToDelete._id}`, {
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

  const handleUpdateTest = async () => {
    if (!testToUpdate) return;

    try {
      const response = await fetch(`/api/pdf-tests/${testToUpdate._id}`, {
        method: 'UPDATE',
        body: JSON.stringify(testToUpdate),

      }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('PDF test Updated successfully');
        setTestToUpdate(null);
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
      setAllTestsLoaded((data.tests || []).length <= 5);
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
    fetchPDFTests()
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
    setDisplayCount(prev => prev + 5);
    if (displayCount + 5 >= filteredAndSortedTests.length) {
      setAllTestsLoaded(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    console.log(formData)
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);

    // Append multiple context PDFs
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
    // Append pyqPDF (assumed to be a single File object)
    // if (formData.pyqPDF) {
    //   formDataToSend.append('pyqPDF', formData.pyqPDF);
    // }


    try {
      const response = await fetch('/api/pdf-tests/create', {
        method: 'POST',
        body: formDataToSend,
      });

      console.log("response", response)

      const textResponse = await response.text();

      try {
        const data = JSON.parse(textResponse);

        if (response.ok && data.success) {
          toast.success('PDF test created successfully!');
          setShowCreateForm(false);

          // Reset form
          setFormData({
            title: '',
            description: '',
            contextPDF: [],
            pyqPDF: null,
          });

          fetchPDFTests();
        } else {
          throw new Error(data.error || 'Failed to create PDF test');
        }
      } catch (jsonError) {
        console.error('Invalid JSON response:', textResponse);
        toast.error('Failed to parse server response');
      }
    } catch (error) {
      console.error('Network or server error:', error);
      toast.error(error instanceof Error ? error.message : 'Unexpected error occurred');
    }
  };



  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center"><Loading /></div>
      </div>
    );
  }

  if (selectedTest) {
    return (
     <>
      console.log("selectedTest", {selectedTest})
      <TestAttempt
        test={selectedTest}
        onComplete={handleTestComplete}
      />
     </>
    );
  }


  if (showResults && currentResults) {
    return (
      <TestResults
        results={currentResults}
        onClose={handleCloseResults}
      />
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-gray-600 text-sm sm:text-base">Welcome,</span>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
          >
            {session?.user?.name || 'User'}
          </button>
        </div>
      </div>

      <Tabs defaultValue="current_affair" className="w-full">
        <TabsList className="flex flex-wrap gap-2 justify-start sm:justify-center mb-6">
          <TabsTrigger value="current_affair">Normal Test</TabsTrigger>
          <TabsTrigger value="pdf">PDF Test</TabsTrigger>
          <TabsTrigger value="pyq-pdf">PYQ Based Test</TabsTrigger>
          <TabsTrigger value="descriptive">Descriptive Test</TabsTrigger>
        </TabsList>

        <TabsContent value="current_affair">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
            <h2 className="text-xl lg:text-2xl font-semibold">My Tests</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => startPredefinedTest('current-affairs')}>
                Current Affairs
              </Button>
              <Button onClick={() => startPredefinedTest('general-knowledge')}>
                General Knowledge
              </Button>
              <Button onClick={() => router.push('/create-test')}>
                Create Test
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'date' | 'name' | 'questions')}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="questions">Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full text-center py-6"><Loading /></div>
            ) : displayedTests.length > 0 ? (
              displayedTests.map((test) => (
                <Card key={test.id} className="flex flex-col justify-between h-full">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span className="truncate text-base font-medium">{test.title}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/edit-test/${test.id}`)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(test.id)}>
                          Delete
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-gray-500">Duration: {test.duration} mins</p>
                    <p className="text-sm text-gray-500">Questions: {test.questions.length}</p>
                    <p className="text-sm text-gray-500">Created: {new Date(test.createdAt).toLocaleDateString()}</p>
                    <Button className="w-full mt-4" onClick={() => router.push(`/take-test/${test.id}`)}>
                      Take Test
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-6 text-gray-500">
                No tests found matching your criteria.
              </div>
            )}

            {!allTestsLoaded && filteredAndSortedTests.length > 5 && (
              <div className="col-span-full text-center mt-4">
                <Button variant="outline" onClick={loadMore}>Load More</Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pdf">
          <div className="space-y-8">
            <section>
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">PDF Management</h2>
                <Button onClick={() => router.push('/create-test')}>Create New Test</Button>
              </div>
              <PdfUpload onUploadSuccess={() => window.dispatchEvent(new Event('pdfUploaded'))} />
            </section>
            <section>
              <PdfList />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="descriptive">
          <section>
            <DescriptivePage />
          </section>
        </TabsContent>

        <TabsContent value="pyq-pdf">
          <section>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tests</h2>
              <Button onClick={() => setShowCreateForm(true)}>Create PDF Test</Button>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold">PDF Tests</h3>
              {pdfTests.length > 0 ? (
                pdfTests.map((test) => (
                  <Card key={test._id}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row justify-between gap-2 items-start sm:items-center">
                        <CardTitle>{test.title}</CardTitle>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => {
                            setViewTest(viewTest?._id === test._id ? null : test);
                          }}>
                            {viewTest?._id === test._id ? 'Hide Questions & Answers' : 'View Questions & Answers'}
                          </Button>
                          <Button variant="outline" onClick={() => setEditingTest(test)}>Edit</Button>
                          <Button variant="destructive" onClick={() => setTestToDelete(test)}>Delete</Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              router.push(`/pdf-tests/${test._id}/attempt`);
                            }}
                          >
                            Attempt Test
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">No PDF tests available.</div>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {viewTest && (
        <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-4">View PDF Test</h3>
          <div className="space-y-4">
            {viewTest.questions?.map((question, index) => (
              <div key={index} className="border rounded-lg p-4">
                <p className="font-medium">Question {index + 1}: {question.question}</p>
                <div className="mt-2">
                  <h4 className="font-medium">Options:</h4>
                  <ul className="list-disc pl-5">
                    {question.options.map((option, idx) => (
                      <li key={idx}>{option}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2">
                  <h4 className="font-medium">Correct Answer:</h4>
                  <p>{question.correctAnswer}</p>
                </div>
                <div className="mt-2">
                  <h4 className="font-medium">Explanation:</h4>
                  <p>{question.explanation}</p>
                </div>
                <div className="mt-2">
                  <h4 className="font-medium">Difficulty:</h4>
                  <p>{question.difficulty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {editingTest && (
        <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-4">Edit PDF Test</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={editingTest?.title || ''}
                onChange={(e) => {
                  if (editingTest) {
                    setEditingTest({
                      ...editingTest,
                      title: e.target.value
                    });
                  }
                }}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editingTest?.description || ''}
                onChange={(e) => {
                  if (editingTest) {
                    setEditingTest({
                      ...editingTest,
                      description: e.target.value
                    });
                  }
                }}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Questions</label>
              {editingTest?.questions?.map((question, index) => (
                <div key={index} className="border p-4 rounded mb-4">
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Question {index + 1}</label>
                    <input
                      type="text"
                      value={question.question}
                      onChange={(e) => {
                        if (editingTest && editingTest.questions) {
                          const newQuestions = [...editingTest.questions];
                          newQuestions[index] = {
                            ...newQuestions[index],
                            question: e.target.value
                          };
                          setEditingTest({
                            ...editingTest,
                            questions: newQuestions
                          });
                        }
                      }}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Options</label>
                    {question.options.map((option, optionIndex) => (
                      <input
                        key={optionIndex}
                        type="text"
                        value={option}
                        onChange={(e) => {
                          if (editingTest && editingTest.questions) {
                            const newQuestions = [...editingTest.questions];
                            newQuestions[index].options[optionIndex] = e.target.value;
                            setEditingTest({
                              ...editingTest,
                              questions: newQuestions
                            });
                          }
                        }}
                        className="w-full p-2 border rounded mb-2"
                      />
                    ))}
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Correct Answer</label>
                    <select
                      value={question.correctAnswer}
                      onChange={(e) => {
                        if (editingTest && editingTest.questions) {
                          const newQuestions = [...editingTest.questions];
                          newQuestions[index] = {
                            ...newQuestions[index],
                            correctAnswer: e.target.value
                          };
                          setEditingTest({
                            ...editingTest,
                            questions: newQuestions
                          });
                        }
                      }}
                      className="w-full p-2 border rounded"
                    >
                      {question.options.map((option, optionIndex) => (
                        <option key={optionIndex} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Explanation</label>
                    <textarea
                      value={question.explanation}
                      onChange={(e) => {
                        if (editingTest && editingTest.questions) {
                          const newQuestions = [...editingTest.questions];
                          newQuestions[index] = {
                            ...newQuestions[index],
                            explanation: e.target.value
                          };
                          setEditingTest({
                            ...editingTest,
                            questions: newQuestions
                          });
                        }
                      }}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Difficulty</label>
                    <select
                      value={question.difficulty}
                      onChange={(e) => {
                        if (editingTest && editingTest.questions) {
                          const newQuestions = [...editingTest.questions];
                          newQuestions[index] = {
                            ...newQuestions[index],
                            difficulty: e.target.value as "easy" | "medium" | "hard"
                          };
                          setEditingTest({
                            ...editingTest,
                            questions: newQuestions
                          });
                        }
                      }}
                      className="w-full p-2 border rounded"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (editingTest && editingTest.questions) {
                        const newQuestions = editingTest.questions.filter((_, i) => i !== index);
                        setEditingTest({
                          ...editingTest,
                          questions: newQuestions
                        });
                      }
                    }}
                  >
                    Remove Question
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                onClick={() => {
                  if (editingTest) {
                    const newQuestion = {
                      question: "",
                      options: ["", "", "", ""],
                      correctAnswer: "",
                      explanation: "",
                      difficulty: "medium" as const
                    };
                    setEditingTest({
                      ...editingTest,
                      questions: [...(editingTest.questions || []), newQuestion]
                    });
                  }
                }}
              >
                Add Question
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingTest(null)}>
                Cancel
              </Button>
              <Button type="submit" onClick={async () => {
                try {
                  const response = await fetch(`/api/pdf-test/${editingTest._id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(editingTest)
                  });

                  if (!response.ok) {
                    throw new Error('Failed to update test');
                  }

                  setEditingTest(null);
                  // Refresh the tests list
                  fetchPDFTests();
                } catch (error) {
                  console.error('Error updating test:', error);
                  // Handle error (show toast notification etc)
                }
              }}>Save Changes</Button>
            </div>
          </form>
        </div>
      )}

      {/* Create PDF Test Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create PDF Test</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Context PDF</label>
              <input
                type="file"
                multiple={true}
                accept=".pdf"
                onChange={(e) => handleFileChange(e, 'context')}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">PYQ PDF</label>
              <input
                type="file"
                multiple={true}
                accept=".pdf"
                onChange={(e) => handleFileChange(e, 'pyq')}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this test? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTest}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>

  );
} 