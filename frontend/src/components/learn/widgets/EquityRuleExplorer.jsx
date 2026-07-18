import React, { useState } from 'react';
import WidgetFrame, { Slider, Readout } from './WidgetFrame';
import { exactTurnEquity, exactRiverEquity, ruleOf2, ruleOf4, pct } from '../../../lessons/math';

// Exact draw-completion probability vs the rule of 2 and 4, per out count and
// timeframe — the same math generate_equity_estimation() grades against.
const EquityRuleExplorer = () => {
  const [outs, setOuts] = useState(9);
  const [timeframe, setTimeframe] = useState('turn'); // 'turn' | 'river'

  const exact = timeframe === 'turn' ? exactTurnEquity(outs) : exactRiverEquity(outs);
  const rulePct = timeframe === 'turn' ? ruleOf2(outs) : ruleOf4(outs);
  const deltaPts = rulePct - exact * 100;
  const diverges = Math.abs(deltaPts) > 3;

  return (
    <WidgetFrame title="Try it: exact equity vs the rule of 2 and 4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <Slider label="Outs" display={String(outs)} value={outs} min={1} max={17} step={1} onChange={setOuts} />
        <div className="flex gap-2">
          {[
            { key: 'turn', label: 'Next card (x2)' },
            { key: 'river', label: 'By the river (x4)' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeframe(key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                timeframe === key
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Readout label="Exact" value={pct(exact, 1)} tone="accent" />
        <Readout label={timeframe === 'turn' ? `Rule of 2 (${outs} × 2)` : `Rule of 4 (${outs} × 4)`} value={`${rulePct}%`} />
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
            diverges
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          {diverges
            ? `Rule is off by ${Math.abs(deltaPts).toFixed(1)} pts here`
            : `Within ${Math.abs(deltaPts).toFixed(1)} pts — trust the rule`}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {timeframe === 'turn'
          ? `One card to come: P = ${outs}/47 = ${pct(exact, 1)}.`
          : `Two cards to come: P = 1 − (${47 - outs}/47 × ${46 - outs}/46) = ${pct(exact, 1)}.`}{' '}
        {timeframe === 'river' && outs >= 12
          ? 'Big draws overshoot the rule of 4 — the exact value runs a few points under it.'
          : 'The shortcut stays honest for normal draw sizes.'}
      </p>
    </WidgetFrame>
  );
};

export default EquityRuleExplorer;
