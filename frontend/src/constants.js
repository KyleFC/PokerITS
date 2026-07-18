// Human-readable labels for the five tracked BKT skills. Kept in one place so
// the dashboard, scenario cards and quiz modal stay in sync.
export const SKILL_LABELS = {
  preflop_range: 'Preflop Range',
  equity_estimation: 'Equity Estimation',
  pot_odds: 'Pot Odds',
  implied_odds: 'Implied Odds',
  mdf: 'Minimum Defense Frequency',
  opponent_reading: 'Opponent Reading',
};

export const MASTERY_THRESHOLD = 0.95;

// Per-skill BKT parameters, mirroring backend bkt_engine.DEFAULT_PARAMS. Used
// only by the dashboard's "BKT component values" detail view; the server is the
// source of truth for the actual math. Keep in sync when the backend retunes.
export const BKT_PARAMS_BY_SKILL = {
  preflop_range: { p_l0: 0.35, p_t: 0.06, p_g: 0.45, p_s: 0.10 },
  equity_estimation: { p_l0: 0.25, p_t: 0.06, p_g: 0.30, p_s: 0.12 },
  pot_odds: { p_l0: 0.30, p_t: 0.06, p_g: 0.45, p_s: 0.10 },
  mdf: { p_l0: 0.25, p_t: 0.05, p_g: 0.40, p_s: 0.12 },
  implied_odds: { p_l0: 0.20, p_t: 0.05, p_g: 0.30, p_s: 0.12 },
  opponent_reading: { p_l0: 0.20, p_t: 0.10, p_g: 0.30, p_s: 0.12 },
};

// A skill isn't shown as mastered until it has at least this many observations,
// however high its posterior. Mirrors bkt_engine.MASTERY_MIN_OBSERVATIONS — the
// server and UI must agree on what "mastered" means, so keep the two in sync.
export const MASTERY_MIN_OBSERVATIONS = 5;

// The single source of truth for "is this skill mastered?" on the client:
// a high posterior AND enough evidence behind it. `observationCount` comes from
// the profile payload's `skill_observations` map. Passing `undefined`/`null`
// counts falls back to the threshold-only check so callers without count data
// degrade gracefully rather than crash.
export const isMastered = (mastery, observationCount) => {
  if (mastery == null || mastery < MASTERY_THRESHOLD) return false;
  if (observationCount == null) return true;
  return observationCount >= MASTERY_MIN_OBSERVATIONS;
};

// Below this posterior a skill is flagged for remediation on the analytics
// timelines. 0.30 is the BKT starting prior P(L0) (bkt_engine.py): sitting
// below where a brand-new student starts means the evidence is persistently
// against mastery, which is exactly the "persistent EV-loss trend" remediation
// trigger project.md §3b describes.
export const REMEDIATION_THRESHOLD = 0.30;

// Chart palette for the analytics pages, validated for the slate-900 surface
// (lightness band, chroma, CVD separation, 3:1 contrast — dataviz validator).
// One hue per job; charts here are single-series so hues never compete.
export const CHART = {
  primary: '#6366f1',   // decision-quality series (mastery, EV loss)
  results: '#0284c7',   // variance-laden results series (BB won/lost)
  good: '#059669',      // mastery line, correct observations
  warn: '#d97706',      // remediation line, deviations
  bad: '#f43f5e',       // incorrect observations, losses
  grid: '#1e293b',      // slate-800 hairlines
  axis: '#64748b',      // slate-500 muted ink
};

// Exploit Lab (Module 5) diagnosis options. Codes mirror
// poker_engine.exploit_profiles.READ_OPTIONS / ADJUST_OPTIONS exactly (the
// backend grades on these codes); the labels describe the *behaviour*, never
// the archetype nickname, so the concept transfers.
export const EXPLOIT_READ_OPTIONS = [
  { code: 'overfolds', label: 'Folds too much', blurb: 'Gives up to aggression.' },
  { code: 'overcalls', label: 'Calls too much', blurb: "Won't let go of a hand." },
  { code: 'overaggro', label: 'Too aggressive', blurb: 'Bets and bluffs constantly.' },
  { code: 'balanced', label: 'Balanced', blurb: 'No obvious leak to attack.' },
];
export const EXPLOIT_ADJUST_OPTIONS = [
  { code: 'bluff_more', label: 'Bluff more', blurb: 'Bet relentlessly; fold them off pots.' },
  { code: 'value_more', label: 'Value-bet thinner', blurb: 'Bet more medium-strength hands.' },
  { code: 'call_down', label: 'Call down lighter', blurb: 'Bluff-catch their over-bets.' },
  { code: 'stay_balanced', label: 'Stay balanced', blurb: "Don't force an exploit that isn't there." },
];

// Archetype display metadata, revealed only after a match completes.
export const EXPLOIT_ARCHETYPES = {
  nit: { label: 'The Nit', leak: 'Over-folds — folds far too often to bets.' },
  station: { label: 'Calling Station', leak: 'Over-calls — almost never folds.' },
  maniac: { label: 'The Maniac', leak: 'Over-aggressive — bets and bluffs relentlessly.' },
  balanced: { label: 'Balanced', leak: 'Few exploitable leaks — a fair baseline.' },
};

// Human labels for the exploit spot classes in the execution report.
export const EXPLOIT_SPOT_LABELS = {
  bluff_spot: 'Bluff spots',
  thin_value_spot: 'Thin value spots',
  bluff_catch_spot: 'Bluff-catch spots',
};

// Skills that have a procedural generator on the backend (mirrors
// poker_engine.generators.GENERATORS). Used to populate the infinite-practice
// skill picker; requesting any other skill returns a 400.
export const GENERATABLE_SKILLS = [
  'preflop_range',
  'equity_estimation',
  'pot_odds',
  'implied_odds',
  'mdf',
];
