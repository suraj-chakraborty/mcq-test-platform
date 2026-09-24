import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { TestCreationProgressModal } from '../components/TestCreationProgressModal';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('TestCreationProgressModal Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <TestCreationProgressModal isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders complete modal UI when isOpen is true', () => {
    render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={0}
        numQuestions={10}
        fileCount={1}
        testTitle="Modern Indian History"
      />
    );

    // Title and question count
    expect(screen.getByText('Synthesizing Your Test')).toBeInTheDocument();
    expect(screen.getByText(/"Modern Indian History"/i)).toBeInTheDocument();
    expect(screen.getByText(/10 Questions/i)).toBeInTheDocument();

    // Pipeline steps
    expect(screen.getByText('Cloud Document Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Layout & Deep Text Extraction')).toBeInTheDocument();
    expect(screen.getByText('Domain & Topic Archetype Analysis')).toBeInTheDocument();
    expect(screen.getByText('High-Yield MCQ Formulation')).toBeInTheDocument();
    expect(screen.getByText('Source Proofs & Anti-Hallucination Audit')).toBeInTheDocument();

    // Engaging study tips
    expect(screen.getByText(/While You Wait/i)).toBeInTheDocument();
  });

  it('calculates and displays estimated remaining time and updates elapsed timer', () => {
    render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={100}
        numQuestions={10}
        fileCount={1}
        testTitle="Calculus Integration"
      />
    );

    // Base estimated time for 10 questions (~28s)
    expect(screen.getByText(/Estimated: ~\d+s remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/Elapsed: 0:00/i)).toBeInTheDocument();

    // Fast-forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/Elapsed: 0:05/i)).toBeInTheDocument();
  });

  it('smoothly reflects upload progress in Phase 1', () => {
    const { rerender } = render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={40} // 40% of 25% = 10%
        numQuestions={10}
      />
    );

    expect(screen.getByText('10%')).toBeInTheDocument();

    rerender(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={80} // 80% of 25% = 20%
        numQuestions={10}
      />
    );

    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('smoothly advances progress over time during server processing', () => {
    render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={100} // Upload finished, in AI synthesis phase
        numQuestions={10}
      />
    );

    // Initial server processing progress (25%)
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Advance 10 seconds into generation
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Progress should have increased beyond 25%
    const progressText = screen.getByText(/\d+%/).textContent;
    const progressNum = parseInt(progressText?.replace('%', '') || '0', 10);
    expect(progressNum).toBeGreaterThan(25);
    expect(progressNum).toBeLessThanOrEqual(96);
  });

  it('displays 100% and completion state when isComplete is true', () => {
    render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={100}
        numQuestions={10}
        isComplete={true}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Finalizing test session/i)).toBeInTheDocument();
  });

  it('cycles rotating tips over time so the user does not get bored', () => {
    render(
      <TestCreationProgressModal
        isOpen={true}
        uploadProgress={100}
        numQuestions={10}
      />
    );

    expect(screen.getByText(/Active Recall/i)).toBeInTheDocument();

    // Fast-forward 4.5 seconds to next tip
    act(() => {
      jest.advanceTimersByTime(4500);
    });

    expect(screen.getByText(/Anti-Hallucination Grounding/i)).toBeInTheDocument();
  });
});
