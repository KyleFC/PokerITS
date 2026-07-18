import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  pokerService: { getHandStats: vi.fn() },
  studentService: {},
  authService: {},
  default: {},
}));

import { pokerService } from '../../services/api';
import ArenaStats from '../ArenaStats';

const STATS = {
  hands_played: 2,
  net_bb_total: -1.0,
  bb_per_100: -50.0,
  record: { win: 0, loss: 2, tie: 0 },
  showdown: { hands: 0, wins: 0 },
  non_showdown: { hands: 2, wins: 0 },
  ev_loss_total_bb: 0.5,
  ev_loss_per_hand_bb: 0.25,
  ev_loss_by_street: { preflop: 0.5 },
  preflop: { graded_hands: 2, deviations: 1, deviation_rate: 0.5 },
  by_profile: {
    balanced: { hands: 2, wins: 0, net_bb: -1.0, ev_loss_bb: 0.5, bb_per_100: -50.0 },
  },
  timeline: [
    { hand: 1, net_bb: -0.5, cumulative_bb: -0.5, ev_loss_bb: 0.5, cumulative_ev_loss_bb: 0.5, outcome: 'loss', bot_profile: 'balanced' },
    { hand: 2, net_bb: -0.5, cumulative_bb: -1.0, ev_loss_bb: 0.0, cumulative_ev_loss_bb: 0.5, outcome: 'loss', bot_profile: 'balanced' },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ArenaStats user={{ username: 'tester' }} onLogout={() => {}} />
    </MemoryRouter>
  );

describe('ArenaStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders decision-quality-first session stats from the API', async () => {
    pokerService.getHandStats.mockResolvedValue(STATS);
    renderPage();
    expect(await screen.findByText('Arena Session Stats')).toBeInTheDocument();
    // Decision quality leads...
    expect(screen.getByText('Avg EV lost per hand')).toBeInTheDocument();
    expect(screen.getByText('0.25 BB')).toBeInTheDocument();
    // ...results are present but explicitly framed as variance.
    expect(screen.getByText('Results (variance)')).toBeInTheDocument();
    expect(screen.getByText(/Where the EV leaks/)).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });

  it('shows an empty state before any hands are played', async () => {
    pokerService.getHandStats.mockResolvedValue({ ...STATS, hands_played: 0, timeline: [] });
    renderPage();
    expect(await screen.findByText('No completed hands yet.')).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    pokerService.getHandStats.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/Failed to load your Arena stats/)).toBeInTheDocument();
  });
});
