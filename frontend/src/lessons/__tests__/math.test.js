import { describe, it, expect } from 'vitest';
import {
  requiredEquity,
  requiredEquityFromPreBet,
  callEvBb,
  alpha,
  mdf,
  bluffBreakeven,
  ruleOf2,
  ruleOf4,
  exactTurnEquity,
  exactRiverEquity,
  setMineRatio,
  EV_LOSS_THRESHOLDS_BB,
} from '../math';

// The drift alarm: every value here is pinned to what the backend graders
// emit (ev_eval.py / generators.py). If a lesson formula and a grader ever
// disagree, one of these breaks before a student sees the contradiction.
describe('lessons/math — mirrors backend graders exactly', () => {
  it('required equity: half-pot bet needs 25% (generate_pot_odds)', () => {
    // Pre-bet pot 10, villain bets 5: B / (P + 2B) = 5/20.
    expect(requiredEquityFromPreBet(10, 5)).toBeCloseTo(0.25, 10);
    // Same spot through the ev_eval signature: pot_before_call = 15, call = 5.
    expect(requiredEquity(15, 5)).toBeCloseTo(0.25, 10);
  });

  it('required equity ladder matches the generator sizes', () => {
    expect(requiredEquityFromPreBet(1, 1 / 3) * 100).toBeCloseTo(20, 5); // 1/3 pot
    expect(requiredEquityFromPreBet(1, 2 / 3) * 100).toBeCloseTo(28.6, 1); // 2/3 pot
    expect(requiredEquityFromPreBet(1, 1) * 100).toBeCloseTo(33.3, 1); // pot
    expect(requiredEquityFromPreBet(1, 2) * 100).toBeCloseTo(40, 5); // 2x pot
  });

  it('call EV: 40% equity vs a half-pot bet is +3 BB (ev_eval.call_ev_bb)', () => {
    // EV = 0.4 * 15 - 0.6 * 5 = 3 — the Lesson 1 worked example.
    expect(callEvBb(0.4, 15, 5)).toBeCloseTo(3, 10);
    // At exactly break-even equity, EV is 0.
    expect(callEvBb(0.25, 15, 5)).toBeCloseTo(0, 10);
  });

  it('MDF and alpha: half-pot bet -> alpha 0.5, MDF 66.7% (generate_mdf)', () => {
    expect(alpha(10, 5)).toBeCloseTo(0.5, 10);
    expect(mdf(10, 5)).toBeCloseTo(2 / 3, 10);
    // MDF = 1 / (1 + alpha) — the identity the lesson teaches.
    expect(mdf(10, 5)).toBeCloseTo(1 / (1 + alpha(10, 5)), 10);
  });

  it('bluff break-even is 1 - MDF', () => {
    expect(bluffBreakeven(10, 5)).toBeCloseTo(1 / 3, 10);
    expect(bluffBreakeven(10, 5) + mdf(10, 5)).toBeCloseTo(1, 10);
    expect(bluffBreakeven(1, 1)).toBeCloseTo(0.5, 10); // pot-sized bluff: 50%
  });

  it('exact draw equities match generate_equity_estimation', () => {
    expect(exactTurnEquity(9)).toBeCloseTo(9 / 47, 10); // ≈ 0.1915
    expect(exactTurnEquity(9) * 100).toBeCloseTo(19.1, 1);
    expect(exactRiverEquity(9) * 100).toBeCloseTo(35.0, 1); // 1 - 38/47 * 37/46
    expect(exactRiverEquity(15) * 100).toBeCloseTo(54.1, 1); // combo draw
    expect(exactRiverEquity(4) * 100).toBeCloseTo(16.5, 1); // gutshot
    expect(exactRiverEquity(8) * 100).toBeCloseTo(31.5, 1); // OESD
  });

  it('rule of 4 overshoots big draws (the lesson-4 caveat)', () => {
    // 15-out combo: rule says 60%, exact is ~54% — rule must be HIGHER.
    expect(ruleOf4(15)).toBeGreaterThan(exactRiverEquity(15) * 100);
    expect(ruleOf4(15) - exactRiverEquity(15) * 100).toBeGreaterThan(3);
    // Normal draws stay within ~3 points.
    expect(Math.abs(ruleOf4(9) - exactRiverEquity(9) * 100)).toBeLessThan(3);
    expect(Math.abs(ruleOf2(9) - exactTurnEquity(9) * 100)).toBeLessThan(3);
  });

  it('set-mine ratio and the EV-loss policy mirror the backend', () => {
    expect(setMineRatio(100, 2.5)).toBeCloseTo(40, 10);
    // EV_LOSS_THRESHOLDS in ev_eval.py, verbatim.
    expect(EV_LOSS_THRESHOLDS_BB).toEqual({
      preflop_range: 0.0,
      pot_odds: 0.5,
      mdf: 0.5,
      equity_estimation: 0.5,
      implied_odds: 1.0,
    });
  });
});
