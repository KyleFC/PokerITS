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
});
