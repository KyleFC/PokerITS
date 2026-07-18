import React, { useState } from 'react';
import WidgetFrame, { Slider, Readout } from './WidgetFrame';
import { mdf, alpha, requiredEquityFromPreBet, pct } from '../../../lessons/math';

// MDF = pot / (pot + bet) = 1 / (1 + alpha), as a function of bet size —
// exactly the formula generate_mdf() grades and explains. The overlay toggle
// shows the caller's required equity for the same size, so the two mirror
// concepts sit side by side instead of blurring together.
const MDFSlider = ({ initialFraction = 0.5 }) => {
  const [fraction, setFraction] = useState(initialFraction); // bet as fraction of pot
  const [showPotOdds, setShowPotOdds] = useState(false);

  // Work in a normalized pot of 100 so the slider is pure "bet fraction".
  const P = 100;
  const B = fraction * P;
  const defend = mdf(P, B);
  const a = alpha(P, B);
  const requiredEq = requiredEquityFromPreBet(P, B);

  return (
    <WidgetFrame title="Try it: MDF by bet size">
      <Slider
        label="Villain's bet (fraction of pot)"
        display={`${Math.round(fraction * 100)}% pot`}
        value={fraction}
        min={0.1}
        max={2}
        step={0.05}
        onChange={setFraction}
      />

      {/* Defend / fold stacked bar */}
      <div>
        <div className="flex h-8 rounded-lg overflow-hidden border border-slate-800">
          <div
            className="bg-emerald-500/60 flex items-center justify-center text-[11px] font-bold text-white min-w-0"
            style={{ width: `${defend * 100}%` }}
          >
            defend {pct(defend, 0)}
          </div>
          <div
            className="bg-rose-500/40 flex items-center justify-center text-[11px] font-bold text-rose-100 min-w-0"
            style={{ width: `${(1 - defend) * 100}%` }}
          >
            fold {pct(1 - defend, 0)}
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Continue (call or raise) with at least the green share of your range, or villain's bluffs auto-profit.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Readout label="MDF" value={pct(defend, 1)} tone="accent" />
        <Readout label="Alpha (bet / pot)" value={a.toFixed(2)} />
        {showPotOdds && <Readout label="Caller's required equity" value={pct(requiredEq, 1)} tone="warn" />}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        MDF = 1 / (1 + {a.toFixed(2)}) = pot / (pot + bet) = {pct(defend, 1)}.
        {showPotOdds && (
          <>
            {' '}Same bet, other question: an individual hand needs {pct(requiredEq, 1)} equity to call
            profitably. MDF is about your <em>range</em>; pot odds are about <em>this hand</em>.
          </>
        )}
      </p>

      <button
        onClick={() => setShowPotOdds((s) => !s)}
        className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
      >
        {showPotOdds ? 'Hide' : 'Compare with'} the pot-odds view of the same bet
      </button>
    </WidgetFrame>
  );
};

export default MDFSlider;
