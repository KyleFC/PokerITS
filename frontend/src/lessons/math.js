// Pure poker math for the Learning Center — the anti-drift keystone.
//
// Every formula here mirrors a backend grader exactly (the source of truth is
// named on each function). Lessons and widgets compute ALL of their numbers
// through this module so the curriculum can never contradict the explanations
// the graders return. math.test.js pins these to backend-emitted values.

// Break-even calling equity = call / (pot after the call).
// `potBeforeCall` includes the villain's bet but excludes the hero's call.
// Source: poker_engine/ev_eval.py required_equity().
export function requiredEquity(potBeforeCall, betToCall) {
  return betToCall / (potBeforeCall + betToCall);
}

// Same break-even equity stated from the PRE-bet pot P and villain bet B:
// call / (pot after your call) = B / (P + 2B).
// Source: poker_engine/generators.py generate_pot_odds().
export function requiredEquityFromPreBet(P, B) {
  return B / (P + 2 * B);
}

// EV (in BB) of calling a bet, relative to folding (which is 0 EV).
// EV = equity * pot_before_call - (1 - equity) * bet_to_call.
// Source: poker_engine/ev_eval.py call_ev_bb().
export function callEvBb(equity, potBeforeCall, betToCall) {
  return equity * potBeforeCall - (1 - equity) * betToCall;
}

// alpha = bet / pot (bet size relative to the pre-bet pot).
// Source: the generate_mdf() explanation string in generators.py.
export function alpha(P, B) {
  return B / P;
}

// Minimum Defense Frequency = 1 / (1 + alpha) = pot / (pot + bet).
// Source: poker_engine/generators.py generate_mdf().
export function mdf(P, B) {
  return P / (P + B);
}

// How often a pure bluff of B into P must work to break even: B / (P + B).
// (This is also 1 - MDF: the two are the same threat seen from either seat.)
export function bluffBreakeven(P, B) {
  return B / (P + B);
}

// Rule-of-thumb equity estimates, in percent.
// Source: generate_equity_estimation() in generators.py ("outs × 2", "outs × 4").
export function ruleOf2(outs) {
  return outs * 2;
}

export function ruleOf4(outs) {
  return outs * 4;
}

// Exact P(hit on the very next card) with `outs` outs and 47 unseen cards.
// Source: generate_equity_estimation(): P = outs / 47.
export function exactTurnEquity(outs) {
  return outs / 47;
}

// Exact P(hit by the river, turn and river combined):
// 1 - P(miss both) = 1 - (47-outs)/47 * (46-outs)/46.
// Source: generate_equity_estimation().
export function exactRiverEquity(outs) {
  return 1 - ((47 - outs) * (46 - outs)) / (47 * 46);
}

// Effective-stack-to-call ratio for set mining.
// Source: generate_implied_odds(): stack / call vs the 15-20x rule of thumb.
export function setMineRatio(stackBb, callBb) {
  return stackBb / callBb;
}

// Set-mining constants, verbatim from generate_implied_odds():
// flop a set ~12% of the time (~7.5:1 against); the generator only produces
// clearly-deep (>= ~20x) or clearly-shallow (<= ~8x) spots so the 15-20x rule
// always gives one defensible answer.
export const SET_MINE_RULE = { min: 15, comfortable: 20, clearlyShallow: 8 };
export const SET_FLOP_PCT = 12; // ~12% to flop a set; ~88% of flops miss

// Villain bet sizes as a fraction of the pre-bet pot, matching the exact
// _BET_SIZES set the pot_odds / mdf generators sample from (generators.py).
export const BET_SIZE_PRESETS = [
  { label: '1/3 pot', fraction: 1 / 3 },
  { label: '1/2 pot', fraction: 0.5 },
  { label: '2/3 pot', fraction: 2 / 3 },
  { label: '3/4 pot', fraction: 0.75 },
  { label: 'Pot', fraction: 1.0 },
  { label: '1.5x pot', fraction: 1.5 },
  { label: '2x pot', fraction: 2.0 },
];

// The EV-loss -> binary-observation policy the live-hand grader applies,
// mirrored from poker_engine/ev_eval.py EV_LOSS_THRESHOLDS so Lesson 1 can
// show students exactly how they are graded.
export const EV_LOSS_THRESHOLDS_BB = {
  preflop_range: 0.0,
  pot_odds: 0.5,
  mdf: 0.5,
  equity_estimation: 0.5,
  implied_odds: 1.0,
};

// Fixed EV-loss charged to a preflop chart deviation (ev_eval.py
// PREFLOP_DEVIATION_PENALTY_BB): a severity marker, not a solved figure.
export const PREFLOP_DEVIATION_PENALTY_BB = 1.0;

// Format a 0-1 probability as a whole-number percent string ("25%").
export function pct(p, digits = 0) {
  return `${(p * 100).toFixed(digits)}%`;
}

// Format a BB amount: drop the decimal for whole numbers (2.0 -> "2"),
// matching the generators' _fmt() so quoted numbers read identically.
export function fmtBb(x) {
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10);
}
