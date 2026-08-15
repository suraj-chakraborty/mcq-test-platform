import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../settings/page';
import { SettingsProvider } from '../providers/SettingsProvider';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation');
jest.mock('sonner');
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('Settings Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    localStorage.clear();
  });

  it('renders theme selector and AI provider sections', () => {
    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    expect(screen.getByText(/Theme & Display Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Engine & Model Provider/i)).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('allows changing AI provider to custom OpenAI', async () => {
    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    const openaiOption = screen.getByText(/OpenAI \(GPT-4o\)/i);
    fireEvent.click(openaiOption);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sk-.../i)).toBeInTheDocument();
    });
  });
});
