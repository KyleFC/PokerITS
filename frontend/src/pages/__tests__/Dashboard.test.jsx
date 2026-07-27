import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  studentService: { getProfile: vi.fn() },
  pokerService: {},
  authService: {},
  default: {},
}));

import { studentService } from '../../services/api';
import Dashboard from '../Dashboard';

const renderDashboard = (user) =>
  render(
    <MemoryRouter>
      <Dashboard user={user} onLogout={() => {}} />
    </MemoryRouter>
  );

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentService.getProfile.mockResolvedValue({
      skills: { pot_odds: 0.30, preflop_range: 0.35 },
      // A brand-new account: the profile exists but nothing has been answered,
      // so no skill has a row in skill_observations.
      skill_observations: {},
    });
  });

  // Raw BKT component values are instructor tooling; for a student they are
  // unexplained jargon sitting next to their own score.
  describe('BKT detail toggle', () => {
    it('is hidden from a normal student account', async () => {
      renderDashboard({ username: 'student', is_staff: false });
      expect(await screen.findByText('Pot Odds')).toBeInTheDocument();
      expect(screen.queryByText('Show Details')).not.toBeInTheDocument();
      expect(screen.queryByText('BKT Component Values')).not.toBeInTheDocument();
    });

    it('is offered to a staff account', async () => {
      renderDashboard({ username: 'instructor', is_staff: true });
      expect(await screen.findByText('Show Details')).toBeInTheDocument();
    });
  });

  it('does not present the untouched BKT prior as progress on a new account', async () => {
    renderDashboard({ username: 'student', is_staff: false });
    // Both seeded skills have zero answers behind them.
    expect(await screen.findAllByText('Not started')).toHaveLength(2);
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });

  it('shows progress for a skill once it has answers behind it', async () => {
    studentService.getProfile.mockResolvedValue({
      skills: { pot_odds: 0.62, preflop_range: 0.35 },
      skill_observations: { pot_odds: 8 },
    });
    renderDashboard({ username: 'student', is_staff: false });

    expect(await screen.findByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('Based on 8 answers.')).toBeInTheDocument();
    // The untouched skill is still correctly marked as not started.
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });
});
