import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface EditTestProps {
  testId: string;
  initialData: {
    title: string;
    duration: number;
    questions: Question[];
  };
}

export default function EditTest({ testId, initialData }: EditTestProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData.title);
  const [duration, setDuration] = useState(initialData.duration);
  const [questions, setQuestions] = useState<Question[]>(initialData.questions);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
      },
    ]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: Question[keyof Question] | [number, string]) => {
    const updatedQuestions = [...questions];
    if (field === 'options') {
      const [optionIndex, optionValue] = value as [number, string];
      updatedQuestions[index].options[optionIndex] = optionValue;
    } else {
      (updatedQuestions[index][field] as any) = value;
    }
    setQuestions(updatedQuestions);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      const updatedQuestions = questions.filter((_, i) => i !== index);
      setQuestions(updatedQuestions);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          duration,
          questions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update test');
      }

      toast.success('Test updated successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to update test');
      console.error('Error updating test:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this test?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete test');
      }

      toast.success('Test deleted successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to delete test');
      console.error('Error deleting test:', error);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Edit Test</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Test Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-8">
              {questions.map((question, questionIndex) => (
                <Card key={questionIndex}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Label>Question {questionIndex + 1}</Label>
                          <Textarea
                            value={question.question}
                            onChange={(e) =>
                              updateQuestion(
                                questionIndex,
                                'question',
                                e.target.value
                              )
                            }
                            required
                          />
                        </div>
                        {questions.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            className="ml-4"
                            onClick={() => removeQuestion(questionIndex)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-4">
                            <Input
                              value={option}
                              onChange={(e) =>
                                updateQuestion(questionIndex, 'options', [
                                  optionIndex,
                                  e.target.value,
                                ])
                              }
                              placeholder={`Option ${optionIndex + 1}`}
                              required
                            />
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() =>
                                updateQuestion(
                                  questionIndex,
                                  'correctAnswer',
                                  optionIndex
                                )
                              }
                              required
                            />
                            <Label>Correct</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <div className="space-x-4">
                <Button type="button" onClick={addQuestion}>
                  Add Question
                </Button>
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete Test
                </Button>
              </div>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 