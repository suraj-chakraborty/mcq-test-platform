'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PDFFile {
  name: string;
  url: string;
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PDFTest {
  _id: string;
  title: string;
  description: string;
  timeLimit: number;
  contextPDFs: PDFFile[];
  pyqPDF: PDFFile;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

export default function PDFTestCreator() {
  const [tests, setTests] = useState<PDFTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testToDelete, setTestToDelete] = useState<PDFTest | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contextPDFs: [] as File[],
    pyqPDF: null as File | null
  });
  const [editingTest, setEditingTest] = useState<PDFTest | null>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/pdf-tests');
      const data = await response.json();
      if (data.success) {
        setTests(data.tests);
      }
    } catch (error) {
      toast.error('Failed to fetch tests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'context' | 'pyq') => {
    const files = e.target.files;
    if (!files) return;

    if (type === 'context') {
      setFormData(prev => ({
        ...prev,
        contextPDFs: [...prev.contextPDFs, ...Array.from(files)]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        pyqPDF: files[0]
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Upload files and get URLs
      const contextPDFs = await Promise.all(
        formData.contextPDFs.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          return {
            name: file.name,
            url: data.url
          };
        })
      );

      const pyqFormData = new FormData();
      pyqFormData.append('file', formData.pyqPDF!);
      const pyqResponse = await fetch('/api/upload', {
        method: 'POST',
        body: pyqFormData
      });
      const pyqData = await pyqResponse.json();

      // Create test
      const response = await fetch('/api/pdf-tests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          contextPDFs,
          pyqPDF: {
            name: formData.pyqPDF!.name,
            url: pyqData.url
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setTests([data.test, ...tests]);
        setFormData({
          title: '',
          description: '',
          contextPDFs: [],
          pyqPDF: null
        });
        toast.success('Test created successfully');
      }
    } catch (error) {
      toast.error('Failed to create test');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (test: PDFTest) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/pdf-tests/${test._id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setTests(tests.filter(t => t._id !== test._id));
        toast.success('Test deleted successfully');
      }
    } catch (error) {
      toast.error('Failed to delete test');
    } finally {
      setIsDeleting(false);
      setTestToDelete(null);
    }
  };

  const handleUpdateQuestion = async (testId: string, questionIndex: number, updatedQuestion: Question) => {
    try {
      const test = tests.find(t => t._id === testId);
      if (!test) return;

      const updatedQuestions = [...test.questions];
      updatedQuestions[questionIndex] = updatedQuestion;

      const response = await fetch(`/api/pdf-tests/${testId}/questions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ questions: updatedQuestions })
      });

      const data = await response.json();
      if (data.success) {
        setTests(tests.map(t => 
          t._id === testId ? { ...t, questions: updatedQuestions } : t
        ));
        toast.success('Question updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update question');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Test from PDFs</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Test Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Context PDFs</Label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handleFileChange(e, 'context')}
                required
              />
              {formData.contextPDFs.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Selected files:</p>
                  <ul className="list-disc list-inside">
                    {formData.contextPDFs.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <Label>Previous Year Questions PDF</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, 'pyq')}
                required
              />
              {formData.pyqPDF && (
                <p className="mt-2 text-sm text-gray-500">
                  Selected: {formData.pyqPDF.name}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Test'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Your Tests</h2>
        {tests.map((test) => (
          <Card key={test._id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{test.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingTest(test)}
                  >
                    Edit Questions
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setTestToDelete(test)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{test.description}</p>
              <div className="mt-4">
                <h3 className="font-semibold">Questions</h3>
                <div className="space-y-4 mt-2">
                  {test.questions.map((question, index) => (
                    <div key={index} className="border rounded p-4">
                      <p className="font-medium">{question.question}</p>
                      <div className="mt-2">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`p-2 rounded ${
                              option === question.correctAnswer
                                ? 'bg-green-100'
                                : 'bg-gray-100'
                            }`}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        Difficulty: {question.difficulty}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the test and all its questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => testToDelete && handleDelete(testToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingTest && (
        <Dialog open={!!editingTest} onOpenChange={() => setEditingTest(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Questions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingTest.questions.map((question, index) => (
                <div key={index} className="border rounded p-4">
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Textarea
                      value={question.question}
                      onChange={(e) => {
                        const updatedQuestion = { ...question, question: e.target.value };
                        handleUpdateQuestion(editingTest._id, index, updatedQuestion);
                      }}
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Options</Label>
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const updatedOptions = [...question.options];
                            updatedOptions[optIndex] = e.target.value;
                            const updatedQuestion = {
                              ...question,
                              options: updatedOptions
                            };
                            handleUpdateQuestion(editingTest._id, index, updatedQuestion);
                          }}
                        />
                        <Button
                          variant={option === question.correctAnswer ? 'default' : 'outline'}
                          onClick={() => {
                            const updatedQuestion = {
                              ...question,
                              correctAnswer: option
                            };
                            handleUpdateQuestion(editingTest._id, index, updatedQuestion);
                          }}
                        >
                          Correct
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Explanation</Label>
                    <Textarea
                      value={question.explanation}
                      onChange={(e) => {
                        const updatedQuestion = {
                          ...question,
                          explanation: e.target.value
                        };
                        handleUpdateQuestion(editingTest._id, index, updatedQuestion);
                      }}
                    />
                  </div>
                  <div className="mt-4">
                    <Label>Difficulty</Label>
                    <select
                      value={question.difficulty}
                      onChange={(e) => {
                        const updatedQuestion = {
                          ...question,
                          difficulty: e.target.value as 'easy' | 'medium' | 'hard'
                        };
                        handleUpdateQuestion(editingTest._id, index, updatedQuestion);
                      }}
                      className="w-full p-2 border rounded"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 