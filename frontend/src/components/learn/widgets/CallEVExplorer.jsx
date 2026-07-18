import React, { useState } from 'react';
import WidgetFrame, { Slider, Readout } from './WidgetFrame';
import { callEvBb, requiredEquityFromPreBet, fmtBb, pct } from '../../../lessons/math';

// Explore EV(call) = equity x pot_before_call - (1 - equity) x call, with the
// break-even equity marked. `pot` is the PRE-bet pot P; villain bets B, so the
// pot the caller stands to win is P + B (ev_eval.call_ev_bb semantics).
const CallEVExplorer = ({ initialPot = 10, initialBet = 5, initialEquity = 40 }) => {
  const [pot, setPot] = useState(initialPot);
  const [bet, setBet] = useState(initialBet);
  const [equityPct, setEquityPct] = useState(initialEquity);

  const potBeforeCall = pot + bet;
  const equity = equityPct / 100;
  const ev = callEvBb(equity, potBeforeCall, bet);
  const breakeven = requiredEquityFromPreBet(pot, bet);
  const evTone = ev > 0.005 ? 'good' : ev < -0.005 ? 'bad' : 'warn';

  return (
    <WidgetFrame title="Try it: the EV of a call">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Slider label="Pot before the bet" display={`${fmtBb(pot)} BB`} value={pot} min={2} max={40} step={1} onChange={setPot} />
        <Slider label="Villain bets" display={`${fmtBb(bet)} BB`} value={bet} min={0.5} max={40} step={0.5} onChange={setBet} />
        <Slider label="Your equity" display={`${equityPct}%`} value={equityPct} min={0} max={100} step={1} onChange={setEquityPct} />
      </div>

      {/* Equity bar with the break-even marker */}
      <div>
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${equity >= breakeven ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
            style={{ width: `${equityPct}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-amber-400"
            style={{ left: `${breakeven * 100}%` }}
            title={`Break-even equity ${pct(breakeven, 1)}`}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          The <span className="text-amber-400 font-semibold">amber line</span> is the break-even equity
          ({pct(breakeven, 1)}). To its right, calling makes money; to its left, folding does.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Readout label="EV of calling" value={`${ev >= 0 ? '+' : ''}${ev.toFixed(2)} BB`} tone={evTone} />
        <Readout label="EV of folding" value="0.00 BB" />
        <Readout label="Break-even equity" value={pct(breakeven, 1)} tone="accent" />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        EV(call) = {pct(equity)} × {fmtBb(potBeforeCall)} − {pct(1 - equity)} × {fmtBb(bet)} ={' '}
        {ev >= 0 ? '+' : ''}{ev.toFixed(2)} BB. The best action is whichever of call / fold has the higher EV —
        no matter which card falls next.
      </p>
    </WidgetFrame>
  );
};

export default CallEVExplorer;
