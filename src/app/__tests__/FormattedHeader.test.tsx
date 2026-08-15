import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormattedHeader } from '../components/FormattedHeader';

describe('FormattedHeader Component', () => {
  it('renders simple text properly', () => {
    render(<FormattedHeader text="What is the chemical symbol for Gold?" />);
    expect(screen.getByText(/What is the chemical symbol for Gold/i)).toBeInTheDocument();
  });

  it('renders Statement I & Statement II pattern as vertical cards', () => {
    const text = `Consider the following statements:
Statement I: The Earth revolves around the Sun.
Statement II: The Moon is a natural satellite of Mars.
Which of the statements given above is/are correct?`;

    render(<FormattedHeader text={text} />);
    expect(screen.getByText(/The Earth revolves around the Sun/i)).toBeInTheDocument();
    expect(screen.getByText(/The Moon is a natural satellite of Mars/i)).toBeInTheDocument();
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('II')).toBeInTheDocument();
  });

  it('renders List I and List II pattern as a 2-column grid', () => {
    const text = `Match List I with List II:
**List I**
A. Article 14
B. Article 21
**List II**
1. Right to Equality
2. Right to Life and Personal Liberty`;

    render(<FormattedHeader text={text} />);
    expect(screen.getByText('List I')).toBeInTheDocument();
    expect(screen.getByText('List II')).toBeInTheDocument();
    expect(screen.getByText(/Article 14/i)).toBeInTheDocument();
    expect(screen.getByText(/Right to Equality/i)).toBeInTheDocument();
  });

  it('returns null when text is empty', () => {
    const { container } = render(<FormattedHeader text="" />);
    expect(container.firstChild).toBeNull();
  });
});
