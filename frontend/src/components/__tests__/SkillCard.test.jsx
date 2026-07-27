import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SkillCard from '../SkillCard';

describe('SkillCard', () => {
  it('renders the label and rounded percentage', () => {
    render(<SkillCard label="Pot Odds" value={0.62} />);
    expect(screen.getByText('Pot Odds')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
  });

  it('shows "Learning" below the mastery threshold', () => {
    render(<SkillCard label="Pot Odds" value={0.62} />);
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.queryByText('Mastered')).not.toBeInTheDocument();
  });

  it('shows "Mastered" at or above the 0.95 threshold', () => {
    render(<SkillCard label="Pot Odds" value={0.96} />);
    expect(screen.getByText('Mastered')).toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
  });

  // A fresh account's number is the BKT prior, not earned progress. Presenting
  // it as progress made a tester think another user's data had leaked in.
  describe('with no answers recorded', () => {
    it('labels the prior as a starting estimate rather than progress', () => {
      render(<SkillCard label="Pot Odds" value={0.35} observationCount={0} />);
      expect(screen.getByText('Not started')).toBeInTheDocument();
      expect(screen.getByText('Starting estimate')).toBeInTheDocument();
      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
      expect(screen.queryByText('Learning')).not.toBeInTheDocument();
      expect(screen.getByText(/not progress you have made/)).toBeInTheDocument();
    });

    it('treats an unknown count as before, so callers without counts degrade gracefully', () => {
      render(<SkillCard label="Pot Odds" value={0.35} observationCount={null} />);
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('Learning')).toBeInTheDocument();
      expect(screen.queryByText('Not started')).not.toBeInTheDocument();
    });
  });

  describe('with answers recorded', () => {
    it('shows progress and flags a thin evidence base', () => {
      render(<SkillCard label="Pot Odds" value={0.62} observationCount={3} />);
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText(/Based on 3 answers — still a rough estimate/)).toBeInTheDocument();
    });

    it('singularises a lone answer', () => {
      render(<SkillCard label="Pot Odds" value={0.62} observationCount={1} />);
      expect(screen.getByText(/Based on 1 answer —/)).toBeInTheDocument();
    });

    it('reports the evidence count once past the mastery minimum', () => {
      render(<SkillCard label="Pot Odds" value={0.62} observationCount={8} />);
      expect(screen.getByText('Based on 8 answers.')).toBeInTheDocument();
    });
  });
});
