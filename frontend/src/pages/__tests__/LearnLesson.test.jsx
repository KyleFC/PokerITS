import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  studentService: { getProfile: vi.fn().mockResolvedValue({ skills: {} }) },
  pokerService: { getPreflopRanges: vi.fn().mockResolvedValue({ six_max: { positions: [] } }) },
  authService: {},
  default: {},
}));

import LearnLesson from '../LearnLesson';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<div>HUB-PAGE</div>} />
        <Route
          path="/learn/:slug"
          element={<LearnLesson user={{ username: 'tester' }} onLogout={() => {}} />}
        />
      </Routes>
    </MemoryRouter>
  );

describe('LearnLesson', () => {
  it('renders the pot-odds lesson with its drill CTA (lazy body)', async () => {
    renderAt('/learn/pot-odds');
    // Layout metadata renders immediately.
    expect(await screen.findByText('Pot Odds & Required Equity')).toBeInTheDocument();
    // The lazy body arrives with the prose content.
    expect(await screen.findByText(/Every bet you face is an offer with a price tag/)).toBeInTheDocument();
    const drill = screen.getByRole('link', { name: /Drill Pot Odds/ });
    expect(drill).toHaveAttribute('href', '/practice?skill=pot_odds');
  });

  it('anchors every section with its meta id for deep links', async () => {
    const { container } = renderAt('/learn/pot-odds');
    // Wait for the lazy body — the sidebar shows section titles immediately,
    // but the anchored <section> elements only exist once the body mounts.
    await screen.findByText(/Every bet you face is an offer with a price tag/);
    for (const id of ['the-price-of-a-call', 'required-equity', 'common-mistakes', 'putting-it-together']) {
      expect(container.querySelector(`#${id}`), `missing #${id}`).toBeTruthy();
    }
  });

  it('sends supporting-concept lessons to adaptive practice', async () => {
    renderAt('/learn/ev-and-decision-quality');
    expect(await screen.findByText(/You call a river bet with the best hand/)).toBeInTheDocument();
    const drill = screen.getByRole('link', { name: /Drill it in Infinite Practice/ });
    expect(drill).toHaveAttribute('href', '/practice');
  });

  it('redirects unknown slugs back to the hub', async () => {
    renderAt('/learn/not-a-lesson');
    expect(await screen.findByText('HUB-PAGE')).toBeInTheDocument();
  });
});
