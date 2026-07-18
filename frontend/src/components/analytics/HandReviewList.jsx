import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

const SUITS = {
  s: { symbol: '♠', cls: 'text-slate-300' },
  h: { symbol: '♥', cls: 'text-rose-400' },
  d: { symbol: '♦', cls: 'text-sky-400' },
  c: { symbol: '♣', cls: 'text-emerald-400' },
};

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

const CardText = ({ card }) => {
  const suit = SUITS[card?.[1]] || { symbol: '?', cls: 'text-slate-500' };
  return (
    <span className="font-mono font-bold text-slate-100">
      {card?.[0]}
      <span className={suit.cls}>{suit.symbol}</span>
    </span>
  );
};

const Cards = ({ cards }) => (
  <span className="inline-flex gap-1.5">
    {(cards || []).map((c, i) => <CardText key={i} card={c} />)}
  </span>
);

// Total graded EV loss for a hand: preflop chart deviation + every graded
// postflop street. Mirrors the backend's stats aggregation.
const totalEvLoss = (hand) =>
  (hand.preflop_chart_deviation || 0) +
  Object.values(hand.postflop_ev_loss_by_street || {}).reduce((a, b) => a + b, 0);

// One completed hand, decision quality first, result (variance) last — the
// review exists to study decisions, not to celebrate or mourn outcomes.
const HandRow = ({ hand }) => {
  const evLoss = totalEvLoss(hand);
  const clean = evLoss === 0;
  const net = hand.net_bb == null ? null : parseFloat(hand.net_bb);
  const streets = STREET_ORDER.filter(
    (s) => (s === 'preflop' && hand.preflop_chart_deviation > 0)
      || (hand.postflop_ev_loss_by_street || {})[s] > 0
  );

  return (
    <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition">
      <td className="py-3 pr-4 whitespace-nowrap">
        <Cards cards={hand.hole_cards} />
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">
        {hand.board?.length
          ? <Cards cards={hand.board} />
          : <span className="text-slate-600 text-xs italic">no flop</span>}
      </td>
      <td className="py-3 pr-4 text-xs font-semibold text-slate-300 capitalize whitespace-nowrap">
        {hand.bot_profile || '—'}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap">
        {clean ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Clean hand
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            −{evLoss.toFixed(2)} BB EV
            <span className="font-medium text-slate-400">
              ({streets.join(', ')})
            </span>
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs whitespace-nowrap">
        {hand.preflop_chart_deviation == null ? (
          <span className="text-slate-600">—</span>
        ) : hand.preflop_chart_deviation > 0 ? (
          <span className="text-amber-400 font-semibold">Off chart</span>
        ) : (
          <span className="text-slate-400">On chart</span>
        )}
      </td>
      <td className={`py-3 text-right font-bold tabular-nums whitespace-nowrap ${
        net == null ? 'text-slate-600'
          : net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-slate-400'
      }`}>
        {net == null ? '—' : `${net > 0 ? '+' : ''}${net.toFixed(1)} BB`}
      </td>
    </tr>
  );
};

// Table of recently completed Arena hands with the EV ground truth captured
// while they were played.
const HandReviewList = ({ hands }) => {
  if (!hands.length) {
    return (
      <p className="text-sm text-slate-500 italic py-6 text-center">
        No completed hands yet — play some hands in the Heads Up Arena and
        they'll show up here for review.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="pb-2 pr-4 font-bold">Your hand</th>
            <th className="pb-2 pr-4 font-bold">Board</th>
            <th className="pb-2 pr-4 font-bold">Opponent</th>
            <th className="pb-2 pr-4 font-bold">Decision quality</th>
            <th className="pb-2 pr-4 font-bold">Preflop</th>
            <th className="pb-2 font-bold text-right">Result</th>
          </tr>
        </thead>
        <tbody>
          {hands.map((hand) => <HandRow key={hand.id} hand={hand} />)}
        </tbody>
      </table>
    </div>
  );
};

export default HandReviewList;
