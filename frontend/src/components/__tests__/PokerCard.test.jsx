import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PokerCard from '../PokerCard';

describe('PokerCard', () => {
  it('renders rank and suit symbol for a spade', () => {
    const { container } = render(<PokerCard value="As" />);
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('♠');
  });

  it('renders nothing when value is missing', () => {
    const { container } = render(<PokerCard value={null} />);
    expect(container.firstChild).toBeNull();
  });
});
