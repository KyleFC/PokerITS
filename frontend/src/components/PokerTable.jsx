import React from 'react';
import { User } from 'lucide-react';
import PokerCard from './PokerCard';

// Stake-style oval poker table. Purely presentational: all poker logic happens
// server-side and this component just draws the frame snapshot it is given:
//   frame = { board, hero_cards, pot_bb, bets_bb, stacks_bb, folded,
//             seat_actions, narration, actor, street, kind }
// `seats` is the seat-label list in table (dealer) order; `hero` is the hero's
// seat label; `button` is the seat with the dealer button.
//
// Seats are laid out around an ellipse with the hero pinned to the bottom
// centre, and every seat shows a persistent action badge (Fold / Call / Bet /
// Raise / Check) so you can see at a glance what each player did.

// Ellipse geometry, in percentages of the table box. The box reserves vertical
// room (top/bottom bands) so the seat pods at 12 o'clock and 6 o'clock are not
// clipped and never collide with the narration rendered beneath the box.
const CENTER_X = 50;
const CENTER_Y = 50;
const SEAT_RX = 43;
const SEAT_RY = 36;
const CHIP_RATIO = 0.52; // bet chips sit partway between a seat and the centre
const TABLE_HEIGHT = 450;

const BADGE_STYLES = {
  Fold: 'bg-slate-800 text-slate-400 border-slate-700',
  Check: 'bg-slate-700 text-slate-200 border-slate-600',
  Call: 'bg-sky-600 text-white border-sky-400',
  Bet: 'bg-emerald-600 text-white border-emerald-400',
  Raise: 'bg-amber-500 text-slate-900 border-amber-300',
};

// Position of seat at `slot` (0 = hero at the bottom) around the ellipse.
const seatPoint = (slot, count, rx = SEAT_RX, ry = SEAT_RY) => {
  const theta = (Math.PI / 2) + (slot * 2 * Math.PI) / count; // 90° = bottom
  return {
    left: CENTER_X + rx * Math.cos(theta),
    top: CENTER_Y + ry * Math.sin(theta),
  };
};

const SeatPod = ({ seat, frame, isHero, isButton }) => {
  const folded = (frame.folded || []).includes(seat);
  const isActor = frame.actor === seat && !folded;
  const badge = folded ? 'Fold' : frame.seat_actions?.[seat];
  const stack = frame.stacks_bb?.[seat];
  const heroCards = frame.hero_cards || [];

  return (
    <div className={`flex flex-col items-center gap-1 w-max ${folded ? 'opacity-40' : ''}`}>
      {/* Cards tucked above the avatar */}
      <div className="flex gap-0.5 -mb-6 z-0">
        {isHero
          ? heroCards.map((c, i) => <PokerCard key={i} value={c} />)
          : !folded && (
              <>
                <PokerCard value="??" />
                <PokerCard value="??" />
              </>
            )}
      </div>

      {/* Action badge */}
      {badge && badge !== 'Bet' && (
        <span
          className={`z-20 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border shadow ${
            BADGE_STYLES[badge] || 'bg-slate-700 text-slate-200 border-slate-600'
          }`}
        >
          {badge}
        </span>
      )}
      {badge === 'Bet' && (
        <span className="z-20 h-5 w-5 rounded-full bg-amber-400 border-2 border-amber-200 shadow flex items-center justify-center" />
      )}

      {/* Avatar + name/stack, Stake-style pill */}
      <div
        className={`relative z-10 flex flex-col items-center rounded-2xl border px-3 py-1.5 min-w-[76px] backdrop-blur-sm transition ${
          isActor
            ? 'border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400/40 shadow-lg shadow-indigo-500/20'
            : 'border-slate-700 bg-slate-900/85'
        }`}
      >
        <div
          className={`absolute -top-4 h-8 w-8 rounded-full flex items-center justify-center border-2 ${
            isHero ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-700 border-slate-500'
          }`}
        >
          <User className="h-4 w-4 text-white" />
        </div>
        {isButton && (
          <span className="absolute -top-1 -right-2 h-4 w-4 rounded-full bg-white text-slate-900 text-[9px] font-black flex items-center justify-center border border-slate-300 shadow z-30">
            D
          </span>
        )}
        <span className="mt-3.5 text-[11px] font-bold text-slate-100 leading-none">{seat}</span>
        {stack != null && (
          <span className="mt-0.5 text-[10px] text-emerald-300/90 font-semibold leading-none">
            {stack} BB
          </span>
        )}
      </div>
    </div>
  );
};

const PokerTable = ({ frame, seats, hero, button }) => {
  if (!frame) return null;

  const heroIndex = seats.indexOf(hero);
  const count = seats.length;
  // Slot 0 is the hero (bottom centre); the rest fan around clockwise in
  // table order.
  const slotOf = (seat) => (seats.indexOf(seat) - heroIndex + count) % count;

  return (
    <div className="w-full mx-auto flex flex-col items-center" style={{ maxWidth: 600 }}>
      <div className="relative w-full" style={{ height: TABLE_HEIGHT }}>
        {/* Felt (inset to leave top/bottom bands for the 6 & 12 o'clock pods) */}
        <div
          className="absolute rounded-[999px] bg-gradient-to-b from-emerald-800/70 to-emerald-950/80 border-[6px] border-slate-800 shadow-[inset_0_0_40px_rgba(0,0,0,0.55)]"
          style={{ left: '2%', right: '2%', top: '13%', bottom: '13%' }}
        >
          {/* Centre: pot + board + stakes label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-emerald-100/90 bg-black/30 px-3 py-1 rounded-full border border-emerald-700/40">
              Pot: {frame.pot_bb} BB
            </span>
            <div className="flex gap-1 min-h-[64px] items-center">
              {frame.board && frame.board.length > 0 ? (
                frame.board.map((c, i) => <PokerCard key={i} value={c} />)
              ) : (
                <span className="text-emerald-200/40 text-xs italic tracking-widest uppercase">preflop</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-200/40 font-medium">
              Poker ITS · No Limit Hold'em
            </span>
          </div>
        </div>

        {/* Bet chips on the felt, in front of each seat */}
        {seats.map((seat) => {
          const bet = frame.bets_bb?.[seat] || 0;
          if (!bet) return null;
          const p = seatPoint(slotOf(seat), count, SEAT_RX * CHIP_RATIO, SEAT_RY * CHIP_RATIO);
          return (
            <div
              key={`bet-${seat}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1"
              style={{ left: `${p.left}%`, top: `${p.top}%` }}
            >
              <span className="h-3 w-3 rounded-full bg-amber-400 border-2 border-amber-200 shadow" />
              <span className="text-[10px] font-bold text-amber-200 bg-black/40 px-1.5 py-0.5 rounded">
                {bet} BB
              </span>
            </div>
          );
        })}

        {/* Seat pods around the oval */}
        {seats.map((seat) => {
          const p = seatPoint(slotOf(seat), count);
          return (
            <div
              key={seat}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${p.left}%`, top: `${p.top}%` }}
            >
              <SeatPod
                seat={seat}
                frame={frame}
                isHero={seat === hero}
                isButton={seat === button}
              />
            </div>
          );
        })}
      </div>

      {/* Narration ticker below the table */}
      <p className="mt-1 text-sm text-slate-300 font-medium text-center bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
        {frame.narration}
      </p>
    </div>
  );
};

export default PokerTable;
