import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import QuizResultPanel from '../QuizResultPanel';

const renderPanel = (result) =>
  render(
    <MemoryRouter>
      <QuizResultPanel result={result} />
    </MemoryRouter>
  );

describe('QuizResultPanel', () => {
  const baseResult = {
    correct: false,
    correct_answer: '25%',
    explanation: 'Required equity = call / (pot after your call).',
    ev_notes: 'Required equity = risk / (risk + reward).',
  };

  it('links the graded skill to its Learning Center lesson', () => {
    renderPanel({ ...baseResult, skill: 'pot_odds' });
    const link = screen.getByRole('link', { name: /Learn more: Pot Odds/ });
    expect(link).toHaveAttribute('href', '/learn/pot-odds');
  });

  it('renders no lesson link for an unknown or absent skill', () => {
    renderPanel({ ...baseResult, skill: 'some_future_skill' });
    expect(screen.queryByText(/Learn more/)).not.toBeInTheDocument();

    renderPanel(baseResult); // no skill field at all
    expect(screen.queryByText(/Learn more/)).not.toBeInTheDocument();
  });

  it('still shows the grading verdict and explanation', () => {
    renderPanel({ ...baseResult, skill: 'mdf' });
    expect(screen.getByText('Incorrect Answer')).toBeInTheDocument();
    expect(screen.getByText(/Required equity = call/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Learn more: MDF/ })).toHaveAttribute('href', '/learn/mdf');
  });

  describe('step-by-step breakdown', () => {
    const breakdown = [
      { label: 'What the call costs you', formula: 'call = the bet you are facing', value: '5 BB' },
      { label: 'Break-even equity', formula: '5 / 20', value: '25%' },
    ];

    it('opens the steps automatically on a missed question', () => {
      renderPanel({ ...baseResult, skill: 'pot_odds', breakdown });
      expect(screen.getByText('What the call costs you')).toBeInTheDocument();
      expect(screen.getByText('5 / 20')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Hide the step-by-step math/ })).toBeInTheDocument();
    });

    it('keeps the steps collapsed when the answer was correct', () => {
      renderPanel({ ...baseResult, correct: true, skill: 'pot_odds', breakdown });
      expect(screen.queryByText('What the call costs you')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Show the step-by-step math/ }));
      expect(screen.getByText('What the call costs you')).toBeInTheDocument();
    });

    it('renders nothing extra when the scenario supplies no breakdown', () => {
      renderPanel({ ...baseResult, skill: 'pot_odds', breakdown: null });
      expect(screen.queryByText(/step-by-step math/)).not.toBeInTheDocument();
    });
  });
});
