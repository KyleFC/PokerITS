import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PokerTable from '../PokerTable';

const frame = {
  kind: 'decision',
  street: 'river',
  narration: 'Your turn — what do you do?',
  actor: 'BB',
  board: ['Kd', 'Qh', '8s', '5d', '3c'],
  hero_cards: ['As', '2s'],
  pot_bb: 15,
  bets_bb: { BB: 0, BTN: 5 },
  stacks_bb: { BB: 95, BTN: 90 },
  folded: [],
  seat_actions: { BB: null, BTN: 'Bet' },
};

describe('PokerTable', () => {
  it('renders the pot size, board cards and narration from a frame', () => {
    const { container } = render(<PokerTable frame={frame} seats={['BB', 'BTN']} hero="BB" />);
    expect(screen.getByText(/Pot: 15 BB/)).toBeInTheDocument();
    expect(screen.getByText(frame.narration)).toBeInTheDocument();
    // Hero cards are shown face-up (rank text appears somewhere on the table).
    expect(container.textContent).toContain('♠'); // As / 2s hero cards
  });

  it('renders both seat labels with their stacks', () => {
    render(<PokerTable frame={frame} seats={['BB', 'BTN']} hero="BB" />);
    expect(screen.getAllByText('BB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BTN').length).toBeGreaterThan(0);
    expect(screen.getByText('90 BB')).toBeInTheDocument(); // villain stack
  });

  it('shows per-seat action badges', () => {
    render(<PokerTable frame={frame} seats={['BB', 'BTN']} hero="BB" />);
    expect(screen.getByText('Bet')).toBeInTheDocument(); // BTN's last action
  });

  it('marks folded seats with a Fold badge', () => {
    const foldedFrame = { ...frame, folded: ['BTN'] };
    render(<PokerTable frame={foldedFrame} seats={['BB', 'BTN']} hero="BB" />);
    expect(screen.getByText('Fold')).toBeInTheDocument();
  });

  it('places the dealer button on the button seat', () => {
    render(<PokerTable frame={frame} seats={['BB', 'BTN']} hero="BB" button="BTN" />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('renders nothing without a frame', () => {
    const { container } = render(<PokerTable frame={null} seats={[]} hero="BB" />);
    expect(container.firstChild).toBeNull();
  });
});
