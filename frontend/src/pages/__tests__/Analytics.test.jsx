import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  studentService: { getFullHistory: vi.fn() },
  pokerService: { getHandHistory: vi.fn() },
  authService: {},
  default: {},
}));

import { studentService, pokerService } from '../../services/api';
import Analytics from '../Analytics';

const OBSERVATIONS = [
  { id: 1, skill: 'pot_odds', correct: true, posterior_after: 0.45, source: 'quiz', timestamp: '2026-07-01T10:00:00Z' },
  { id: 2, skill: 'pot_odds', correct: false, posterior_after: 0.38, source: 'hand', timestamp: '2026-07-02T10:00:00Z' },
];

const HAND_PAGE = {
  count: 1,
  next: null,
  previous: null,
  results: [{
    id: 'abc-123',
    timestamp: '2026-07-02T10:00:00Z',
    hole_cards: ['As', 'Kd'],
    board: ['Qh', '7s', '2c'],
    actions: [],
    pot_size: '4.00',
    net_bb: '-2.00',
    bot_profile: 'nit',
    preflop_chart_deviation: 0.0,
    postflop_ev_loss_by_street: { flop: 1.2 },
    outcome: 'loss',
  }],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <Analytics user={{ username: 'tester' }} onLogout={() => {}} />
    </MemoryRouter>
  );

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentService.getFullHistory.mockResolvedValue(OBSERVATIONS);
    pokerService.getHandHistory.mockResolvedValue(HAND_PAGE);
  });

  it('renders a mastery timeline card for every skill', async () => {
    renderPage();
    expect(await screen.findByText('Learning Analytics')).toBeInTheDocument();
    for (const label of ['Preflop Range', 'Equity Estimation', 'Pot Odds', 'Implied Odds', 'Minimum Defense Frequency', 'Opponent Reading']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Skills without observations show the empty-state prompt (only pot_odds has
    // observations in the fixture, so the other five — including the new
    // Opponent Reading skill — show the empty state).
    expect(screen.getAllByText(/No observations yet/).length).toBe(5);
  });

  it('renders the hand review list with decision quality before results', async () => {
    renderPage();
    expect(await screen.findByText('Hand Review')).toBeInTheDocument();
    expect(screen.getByText(/−1.20 BB EV/)).toBeInTheDocument();
    expect(screen.getByText('On chart')).toBeInTheDocument();
    expect(screen.getByText('-2.0 BB')).toBeInTheDocument();
  });
});
