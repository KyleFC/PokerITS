import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/api', () => ({
  adminService: {
    getOverview: vi.fn(),
    getUsers: vi.fn(),
    getItems: vi.fn(),
    getCurves: vi.fn(),
    getHealth: vi.fn(),
    getUser: vi.fn(),
    downloadExport: vi.fn(),
  },
  studentService: {},
  pokerService: {},
  authService: {},
  default: {},
}));

import { adminService } from '../../../services/api';
import AdminOverview from '../AdminOverview';
import AdminItems from '../AdminItems';

const OVERVIEW = {
  generated_at: '2026-07-25T12:00:00Z',
  users: { total: 12, staff: 1, engaged: 9, new_7d: 3, active_7d: 5, active_30d: 9 },
  observations: {
    total: 240, correct: 150, accuracy: 0.625,
    by_source: { quiz: { n: 100, n_correct: 70, accuracy: 0.7 } },
  },
  play: {
    arena_hands: 80, lab_hands: 20, matches: 6, matches_complete: 3,
    match_completion_rate: 0.5,
  },
  skills: [
    {
      skill: 'pot_odds', label: 'Pot Odds', students_with_profile: 9,
      mean_mastery: 0.42, median_mastery: 0.4, mastered_students: 2,
      histogram: [1, 2, 3, 2, 1, 0],
      histogram_labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-95%', '95%+'],
      observations: 100, observations_correct: 70, accuracy: 0.7,
      students_attempted: 9,
      params: { p_l0: 0.3, p_t: 0.06, p_g: 0.45, p_s: 0.1 },
    },
  ],
  activity: [{ date: '2026-07-25', observations: 10, observations_correct: 6, hands: 4 }],
  mastery_threshold: 0.95,
};

// Mirrors the guard in App.jsx: signed out goes to login, signed in without
// is_staff goes to the student dashboard, staff renders the console.
const GuardedAdmin = ({ auth, user }) => (
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path="/" element={<div>Student Dashboard</div>} />
      <Route path="/login" element={<div>Login Page</div>} />
      <Route
        path="/admin"
        element={
          !auth ? (
            <Navigate to="/login" replace />
          ) : user?.is_staff ? (
            <AdminOverview user={user} onLogout={() => {}} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  </MemoryRouter>
);

describe('admin route guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminService.getOverview.mockResolvedValue(OVERVIEW);
  });

  it('redirects a signed-in non-staff user to the student dashboard', async () => {
    render(<GuardedAdmin auth user={{ username: 'student', is_staff: false }} />);
    expect(await screen.findByText('Student Dashboard')).toBeInTheDocument();
    // The guard must bounce before any admin data is requested.
    expect(adminService.getOverview).not.toHaveBeenCalled();
  });

  it('redirects an anonymous visitor to login', async () => {
    render(<GuardedAdmin auth={false} user={null} />);
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(adminService.getOverview).not.toHaveBeenCalled();
  });

  it('renders the console for a staff user', async () => {
    render(<GuardedAdmin auth user={{ username: 'instructor', is_staff: true }} />);
    expect(await screen.findByText('Cohort Overview')).toBeInTheDocument();
    expect(adminService.getOverview).toHaveBeenCalled();
  });
});

describe('AdminOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminService.getOverview.mockResolvedValue(OVERVIEW);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminOverview user={{ username: 'instructor', is_staff: true }} onLogout={() => {}} />
      </MemoryRouter>
    );

  it('separates registered accounts from engaged students', async () => {
    renderPage();
    // 12 accounts exist but only 9 have answered anything — reporting the
    // cohort against the wrong denominator is the easy mistake here.
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('Engaged')).toBeInTheDocument();
    expect(screen.getByText('answered ≥ 1 question')).toBeInTheDocument();
  });

  it('shows an error banner when the API fails', async () => {
    adminService.getOverview.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(
      await screen.findByText('Failed to load cohort overview.')
    ).toBeInTheDocument();
  });
});

describe('AdminItems', () => {
  const ITEMS = {
    items: [
      {
        item_id: 'suspect_item', title: 'Suspect Item', subtitle: '',
        skill: 'pot_odds', skill_label: 'Pot Odds', generated: false,
        orphaned: false, attempts: 40, correct: 20, p_value: 0.5,
        students: 10, discrimination: -0.62, correct_answer: 'Call',
        flags: ['possible_miskey'],
      },
      {
        item_id: 'healthy_item', title: 'Healthy Item', subtitle: '',
        skill: 'mdf', skill_label: 'Minimum Defense Frequency', generated: false,
        orphaned: false, attempts: 30, correct: 18, p_value: 0.6,
        students: 10, discrimination: 0.44, correct_answer: 'Fold',
        flags: [],
      },
    ],
    unattempted: [
      { item_id: 'implied_01', title: 'Set Mining', skill: 'implied_odds', skill_label: 'Implied Odds' },
    ],
    thresholds: {
      min_attempts: 10, min_students: 5, too_easy_p: 0.95,
      too_hard_p: 0.25, miskey_d: -0.15, weak_d: 0.05,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adminService.getItems.mockResolvedValue(ITEMS);
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminItems user={{ username: 'instructor', is_staff: true }} onLogout={() => {}} />
      </MemoryRouter>
    );

  it('surfaces miskey suspects in a callout above the table', async () => {
    renderPage();
    expect(
      await screen.findByText('1 item may have the wrong answer key')
    ).toBeInTheDocument();
    // The keyed answer is shown so an instructor can check it without digging
    // through scenarios.json.
    expect(screen.getByText(/keyed as/)).toBeInTheDocument();
  });

  it('renders negative discrimination distinctly from healthy items', async () => {
    renderPage();
    expect(await screen.findByText('-0.62')).toBeInTheDocument();
    expect(screen.getByText('+0.44')).toBeInTheDocument();
  });

  it('lists authored items nobody has attempted', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Set Mining')).toBeInTheDocument());
    // "Never attempted" is both a KPI label and the panel heading; match the heading.
    expect(
      screen.getByRole('heading', { name: 'Never attempted' })
    ).toBeInTheDocument();
  });
});
