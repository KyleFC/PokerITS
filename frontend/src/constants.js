// Human-readable labels for the five tracked BKT skills. Kept in one place so
// the dashboard, scenario cards and quiz modal stay in sync.
export const SKILL_LABELS = {
  preflop_range: 'Preflop Range',
  equity_estimation: 'Equity Estimation',
  pot_odds: 'Pot Odds',
  implied_odds: 'Implied Odds',
  mdf: 'Minimum Defense Frequency',
};

export const MASTERY_THRESHOLD = 0.95;

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
