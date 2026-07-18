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
import LearnHub from '../LearnHub';
import { LESSONS } from '../../lessons/meta';

const renderPage = () =>
  render(
    <MemoryRouter>
      <LearnHub user={{ username: 'tester' }} onLogout={() => {}} />
    </MemoryRouter>
  );

describe('LearnHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentService.getProfile.mockResolvedValue({
      skills: { pot_odds: 0.42, preflop_range: 0.96 },
    });
  });

  it('renders every lesson in curriculum order with a working link', async () => {
    renderPage();
    expect(await screen.findByText('Learning Center')).toBeInTheDocument();
    for (const lesson of LESSONS) {
      const link = screen.getByRole('link', { name: new RegExp(lesson.title) });
      expect(link).toHaveAttribute('href', `/learn/${lesson.slug}`);
    }
  });

  it('links the Fundamentals card to the tutorial', async () => {
    renderPage();
    const card = await screen.findByRole('link', { name: /Fundamentals: Poker Rules/ });
    expect(card).toHaveAttribute('href', '/tutorial');
  });

  it('shows live mastery chips for skill lessons once the profile loads', async () => {
    renderPage();
    expect(await screen.findByText('Mastery 42%')).toBeInTheDocument(); // pot_odds
    expect(screen.getByText('Mastery 96%')).toBeInTheDocument(); // preflop_range, mastered styling
  });

  it('still renders the full curriculum when the profile fetch fails', async () => {
    studentService.getProfile.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByText('Learning Center')).toBeInTheDocument();
    expect(screen.getByText(LESSONS[0].title)).toBeInTheDocument();
    expect(screen.queryByText(/^Mastery \d+%$/)).not.toBeInTheDocument();
  });
});
