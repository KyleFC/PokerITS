import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import PokerCard from '../PokerCard';

// Compact, purely presentational 6-max table used by the Game Basics
// animations. It draws whatever single frame it is handed:
//
//   frame = { heroCards, dealt, board, pot, bets, badges, folded, actor,
//             highlight }
//
// Deliberately separate from components/PokerTable.jsx: that one renders live
// gameplay frames from the server at full size, this one is a teaching diagram
// small enough to sit beside a paragraph of prose. Seat geometry matches
// (slot 0 = hero at the bottom, slots increase clockwise) so the two read as
// the same table.

const CENTER = 50;
const SEAT_RX = 39;
const SEAT_RY = 33;
// Bet chips ride their own, flatter ellipse rather than a fraction of the seat
// one. Seat pods are a fixed pixel size while the ellipse scales with the
// table, so the free ring the chips live in is the tightest thing in this
// layout, and it is tight in each axis for a different reason:
//   ry — at 6 and 12 o'clock the board, the chip and the hole cards stack on
//        one axis. At 270px tall that lane was 5px wide and the chip rendered
//        behind the cards; the height below reopens it to ~10px either side.
//   rx — at 8 and 4 o'clock a chip sits level with the board, so it has to
//        clear the board's edge without backing into its own seat pod.
// A five-card board plus a bet from a side seat would still be snug, but no
// sequence pairs those; revisit these if one ever does.
const CHIP_RX_RATIO = 0.56;
const CHIP_RY_RATIO = 0.45;
const TABLE_WIDTH = 440;
const TABLE_HEIGHT = 360;

const BADGE_STYLES = {
  Fold: 'bg-slate-800 text-slate-400 border-slate-700',
  Check: 'bg-slate-700 text-slate-200 border-slate-600',
  Call: 'bg-sky-600 text-white border-sky-400',
  Bet: 'bg-emerald-600 text-white border-emerald-400',
  Raise: 'bg-amber-500 text-slate-900 border-amber-300',
  'All-In': 'bg-rose-600 text-white border-rose-400',
};

// Position of the seat in `slot` (0 = hero, bottom centre) around the ellipse.
const seatPoint = (slot, count, rx = SEAT_RX, ry = SEAT_RY) => {
  const theta = Math.PI / 2 + (slot * 2 * Math.PI) / count; // 90° = bottom
  return {
    left: CENTER + rx * Math.cos(theta),
    top: CENTER + ry * Math.sin(theta),
  };
};

// Vector from a point on the table back to the middle, in px, so a card or
// chip can start its entrance at the deck. Needs the measured box: percentages
// alone can't be turned into a CSS translate.
const offsetToCentre = (point, box) => ({
  '--dx': `${((CENTER - point.left) / 100) * box.w}px`,
  '--dy': `${((CENTER - point.top) / 100) * box.h}px`,
});

const SeatPod = ({ seat, frame, isHero, isButton, flight }) => {
  const folded = (frame.folded || []).includes(seat.id);
  const isActor = frame.actor === seat.id && !folded;
  const badge = frame.badges?.[seat.id];
  const heroCards = frame.heroCards || [];
  const hasFaceDown = (frame.dealt || []).includes(seat.id);
  const spotlit = isHero && frame.highlight === 'hero';

  return (
    <div className={`flex flex-col items-center gap-1 w-max transition-opacity duration-500 ${folded ? 'opacity-35' : ''}`}>
      {/* Hole cards, tucked above the avatar */}
      <div className="flex gap-0.5 -mb-4 z-0 min-h-[44px] items-end">
        {isHero
          ? heroCards.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="animate-deal-in block"
                style={{ ...flight, animationDelay: `${i * 160}ms` }}
              >
                <PokerCard value={c} size="sm" />
              </span>
            ))
          : hasFaceDown && (
              <>
                <span className="animate-deal-in block" style={flight}>
                  <PokerCard value="??" size="sm" />
                </span>
                <span className="animate-deal-in block" style={{ ...flight, animationDelay: '90ms' }}>
                  <PokerCard value="??" size="sm" />
                </span>
              </>
            )}
      </div>

      {badge && (
        <span
          className={`z-20 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shadow ${
            BADGE_STYLES[badge] || 'bg-slate-700 text-slate-200 border-slate-600'
          }`}
        >
          {badge}
        </span>
      )}

      <div
        className={`relative z-10 flex flex-col items-center rounded-xl border px-2 py-1 min-w-[56px] transition-all duration-300 ${
          isActor
            ? 'border-indigo-400 bg-indigo-500/20 ring-2 ring-indigo-400/50 animate-pulse-ring'
            : spotlit
              ? 'border-indigo-400/60 bg-indigo-500/10'
              : 'border-slate-700 bg-slate-900/85'
        }`}
      >
        <div
          className={`absolute -top-3 h-6 w-6 rounded-full flex items-center justify-center border-2 ${
            isHero ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-700 border-slate-500'
          }`}
        >
          <User className="h-3 w-3 text-white" />
        </div>
        {isButton && (
          <span className="absolute -top-1 -right-2 h-3.5 w-3.5 rounded-full bg-white text-slate-900 text-[8px] font-black flex items-center justify-center border border-slate-300 shadow z-30">
            D
          </span>
        )}
        <span className="mt-2.5 text-[10px] font-bold text-slate-100 leading-none">{seat.label}</span>
        {seat.sub && <span className="text-[8px] text-slate-500 font-semibold leading-none mt-0.5">{seat.sub}</span>}
      </div>
    </div>
  );
};

const MiniTable = ({ seats, hero, button, frame }) => {
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Card/chip entrances translate from the middle of the table, which means
  // they need real pixels. Measure once and on resize; in jsdom this stays
  // 0×0 and the entrances simply become fades.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Board cards that arrived in this step stagger in; ones already on the felt
  // must not re-animate, so remember how many there were last render.
  const seenBoard = useRef(0);
  const boardBefore = seenBoard.current;
  const board = frame.board || [];
  useEffect(() => {
    seenBoard.current = board.length;
  });

  const count = seats.length;
  const heroIndex = seats.findIndex((s) => s.id === hero);
  const slotOf = (seatId) => (seats.findIndex((s) => s.id === seatId) - heroIndex + count) % count;

  return (
    // Fixed size, never fluid. Pods and cards are a fixed pixel size while seat
    // and chip positions are percentages, so the clearances between them only
    // hold at one width — let it get narrower and chips start clipping the
    // board and their own pods. On a narrow phone it pans instead (the caller
    // wraps this in an overflow-x container).
    <div
      className="relative mx-auto shrink-0"
      style={{ width: TABLE_WIDTH, height: TABLE_HEIGHT }}
      ref={boxRef}
    >
      {/* Felt */}
      <div
        className="absolute rounded-[999px] bg-gradient-to-b from-emerald-800/70 to-emerald-950/80 border-4 border-slate-800 shadow-[inset_0_0_30px_rgba(0,0,0,0.55)]"
        style={{ left: '4%', right: '4%', top: '14%', bottom: '14%' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <span className="text-[10px] font-bold text-emerald-100/90 bg-black/30 px-2 py-0.5 rounded-full border border-emerald-700/40 tabular-nums">
            Pot: {frame.pot ?? 0} BB
          </span>
          <div
            className={`flex gap-1 min-h-[44px] items-center rounded-lg transition-all duration-300 ${
              frame.highlight === 'board' ? 'ring-2 ring-amber-300/60 px-1' : ''
            }`}
          >
            {board.length > 0 ? (
              board.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="animate-flip-in block"
                  style={{ animationDelay: `${Math.max(0, i - boardBefore) * 140}ms` }}
                >
                  <PokerCard value={c} size="sm" />
                </span>
              ))
            ) : (
              <span className="text-emerald-200/40 text-[10px] italic tracking-widest uppercase">preflop</span>
            )}
          </div>
        </div>
      </div>

      {/* Chips in front of each seat that has money out */}
      {seats.map((seat) => {
        const bet = frame.bets?.[seat.id] || 0;
        if (!bet) return null;
        const p = seatPoint(slotOf(seat.id), count, SEAT_RX * CHIP_RX_RATIO, SEAT_RY * CHIP_RY_RATIO);
        return (
          <div
            key={`bet-${seat.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <span
              className="animate-chip-in flex items-center gap-1"
              style={offsetToCentre(p, box)}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-amber-200 shadow" />
              <span className="text-[9px] font-bold text-amber-200 bg-black/50 px-1 py-0.5 rounded tabular-nums">
                {bet} BB
              </span>
            </span>
          </div>
        );
      })}

      {/* Seats */}
      {seats.map((seat) => {
        const p = seatPoint(slotOf(seat.id), count);
        return (
          <div
            key={seat.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <SeatPod
              seat={seat}
              frame={frame}
              isHero={seat.id === hero}
              isButton={seat.id === button}
              flight={offsetToCentre(p, box)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default MiniTable;
