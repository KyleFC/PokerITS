import React, { useState } from 'react';
import WidgetFrame, { Slider, Readout } from './WidgetFrame';
import { bluffBreakeven, alpha, requiredEquityFromPreBet, pct } from '../../../lessons/math';

// The same bet seen from both seats: the bluffer needs folds B/(P+B) of the
// time to break even; the defender's individual hand needs B/(P+2B) equity to
// call. Sizing a bet is choosing both numbers at once.
const BluffBreakevenExplorer = ({ initialFraction = 0.66 }) => {
  const [fraction, setFraction] = useState(initialFraction);

  const P = 100;
  const B = fraction * P;
  const breakeven = bluffBreakeven(P, B);
  const a = alpha(P, B);
  const requiredEq = requiredEquityFromPreBet(P, B);

  return (
    <WidgetFrame title="Try it: one bet, two seats">
      <Slider
        label="Bet size (fraction of pot)"
        display={`${Math.round(fraction * 100)}% pot`}
        value={fraction}
        min={0.1}
        max={2}
        step={0.05}
        onChange={setFraction}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-300">The bettor's side</p>
          <Readout label="Bluff must work" value={pct(breakeven, 1)} tone="warn" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            A pure bluff risks {Math.round(B)} to win {P}: it breaks even when villain folds{' '}
            {Math.round(B)} / ({P} + {Math.round(B)}) = {pct(breakeven, 1)} of the time.
          </p>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">The defender's side</p>
          <Readout label="A call needs equity" value={pct(requiredEq, 1)} tone="accent" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Facing the same bet, a single hand calls profitably with more than {pct(requiredEq, 1)} equity
            (pot odds), and the whole range must continue 1 − {pct(breakeven, 1)} = {pct(1 - breakeven, 1)} of
            the time (MDF).
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Alpha = bet / pot = {a.toFixed(2)}. Bigger bets buy more fold equity but need to work more often —
        and give the defender a worse price at the same time.
      </p>
    </WidgetFrame>
  );
};

export default BluffBreakevenExplorer;
