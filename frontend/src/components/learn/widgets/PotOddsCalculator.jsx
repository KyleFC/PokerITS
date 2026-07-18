import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import WidgetFrame, { Readout } from './WidgetFrame';
import { requiredEquityFromPreBet, mdf, fmtBb, pct, BET_SIZE_PRESETS } from '../../../lessons/math';

const NumberInput = ({ label, value, onChange, min = 0.5, max = 999 }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-400 block mb-1.5">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={0.5}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-100 focus:border-indigo-500 focus:outline-none"
    />
  </label>
);

// Pot-odds calculator: pre-bet pot P + villain bet B -> required break-even
// equity B / (P + 2B), exactly as generate_pot_odds() computes and explains
// it. The "common mistakes" drawer shows the three classic wrong answers the
// generator uses as distractors, so students learn to recognise them.
const PotOddsCalculator = ({ initialPot = 10, initialBet = 5 }) => {
  const [pot, setPot] = useState(initialPot);
  const [bet, setBet] = useState(initialBet);
  const [showMistakes, setShowMistakes] = useState(false);

  const required = requiredEquityFromPreBet(pot, bet);
  const totalAfterCall = pot + 2 * bet;
  // Odds form: you risk B to win what's already out there (P + B).
  const oddsRatio = (pot + bet) / bet;

  const mistakes = [
    {
      formula: `B / (P + B) = ${fmtBb(bet)} / ${fmtBb(pot + bet)}`,
      value: bet / (pot + bet),
      label: 'Forgetting your own call joins the pot',
    },
    {
      formula: `B / P = ${fmtBb(bet)} / ${fmtBb(pot)}`,
      value: bet / pot,
      label: 'Dividing by the pre-bet pot',
    },
    {
      formula: `P / (P + B) = ${fmtBb(pot)} / ${fmtBb(pot + bet)}`,
      value: mdf(pot, bet),
      label: "That's MDF — a range question, not this hand's price",
    },
  ];

  return (
    <WidgetFrame title="Try it: pot-odds calculator">
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <NumberInput label="Pot before the bet (BB)" value={pot} onChange={setPot} />
        <NumberInput label="Villain bets (BB)" value={bet} onChange={setBet} />
      </div>

      {/* The seven bet sizes the drill generator actually deals */}
      <div className="flex flex-wrap gap-2">
        {BET_SIZE_PRESETS.map(({ label, fraction }) => (
          <button
            key={label}
            onClick={() => setBet(Math.max(0.5, Math.round(fraction * pot * 2) / 2))}
            className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500/60 hover:text-indigo-300 transition cursor-pointer"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Readout label="Required equity" value={pct(required, 1)} tone="accent" />
        <Readout label="Pot odds" value={`${oddsRatio.toFixed(1)} : 1`} />
        <Readout label="Pot after your call" value={`${fmtBb(totalAfterCall)} BB`} />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Required equity = call / (pot after your call) = {fmtBb(bet)} / ({fmtBb(pot)} + {fmtBb(bet)} +{' '}
        {fmtBb(bet)}) = {pct(required, 1)}. Win more often than that and calling is +EV.
      </p>

      <button
        onClick={() => setShowMistakes((s) => !s)}
        className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
      >
        {showMistakes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showMistakes ? 'Hide' : 'Show'} the three classic mistakes for this spot
      </button>
      {showMistakes && (
        <div className="space-y-2">
          {mistakes.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-3 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-mono text-rose-300 line-through decoration-rose-500/60">{m.formula}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{m.label}</p>
              </div>
              <span className="text-sm font-bold text-rose-400 line-through decoration-rose-500/60 tabular-nums shrink-0">
                {pct(m.value, 1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetFrame>
  );
};

export default PotOddsCalculator;
