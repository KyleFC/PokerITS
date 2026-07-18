import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PotOddsCalculator from '../learn/widgets/PotOddsCalculator';
import MDFSlider from '../learn/widgets/MDFSlider';

// Interaction tests for the two calculator widgets whose numbers students
// will cross-check against drill explanations. The values asserted here are
// the same ones generate_pot_odds / generate_mdf put in their explanations.
describe('PotOddsCalculator', () => {
  it('shows 25% required equity for a half-pot bet (10 pot / 5 bet)', () => {
    render(<PotOddsCalculator initialPot={10} initialBet={5} />);
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('3.0 : 1')).toBeInTheDocument(); // 15 : 5
    expect(screen.getByText('20 BB')).toBeInTheDocument(); // pot after the call
  });

  it('recomputes when a preset bet size is clicked', () => {
    render(<PotOddsCalculator initialPot={10} initialBet={5} />);
    fireEvent.click(screen.getByRole('button', { name: '2x pot' }));
    expect(screen.getByText('40.0%')).toBeInTheDocument(); // 20 / (10 + 40)
  });

  it('reveals the three classic mistakes with their wrong values', () => {
    render(<PotOddsCalculator initialPot={10} initialBet={5} />);
    fireEvent.click(screen.getByRole('button', { name: /classic mistakes/ }));
    expect(screen.getByText('33.3%')).toBeInTheDocument(); // B/(P+B)
    expect(screen.getByText('50.0%')).toBeInTheDocument(); // B/P
    expect(screen.getByText('66.7%')).toBeInTheDocument(); // P/(P+B) = MDF
  });
});

describe('MDFSlider', () => {
  it('shows MDF 66.7% and alpha 0.50 for a half-pot bet', () => {
    render(<MDFSlider initialFraction={0.5} />);
    expect(screen.getByText('66.7%')).toBeInTheDocument();
    expect(screen.getByText('0.50')).toBeInTheDocument();
    expect(screen.getByText(/defend 67%/)).toBeInTheDocument();
    expect(screen.getByText(/fold 33%/)).toBeInTheDocument();
  });

  it('recomputes as the bet-size slider moves', () => {
    render(<MDFSlider initialFraction={0.5} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
    expect(screen.getByText('50.0%')).toBeInTheDocument(); // pot-sized bet -> MDF 50%
  });

  it('overlays the pot-odds view of the same bet on demand', () => {
    render(<MDFSlider initialFraction={0.5} />);
    fireEvent.click(screen.getByRole('button', { name: /Compare with/ }));
    expect(screen.getByText('25.0%')).toBeInTheDocument(); // caller's required equity
    expect(screen.getByText(/about your/)).toBeInTheDocument();
  });
});
