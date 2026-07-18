import React, { useState } from 'react';
import WidgetFrame from './WidgetFrame';
import PokerCard from '../../PokerCard';

// The four standard draws, constructed exactly like the equity generator's
// _DRAW_TEMPLATES (flush 9 / OESD 8 / gutshot 4 / combo 15), with every out
// enumerated. The combo preset strikes through the two straight-flush cards
// so the double-counting trap is visible, not just stated.
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS = { s: 'text-slate-200', h: 'text-rose-400', d: 'text-blue-400', c: 'text-emerald-400' };

const spades = (ranks) => ranks.map((r) => `${r}s`);
const allSuits = (rank) => ['s', 'h', 'd', 'c'].map((s) => `${rank}${s}`);

const PRESETS = [
  {
    key: 'flush',
    label: 'Flush draw',
    outs: 9,
    hole: ['As', 'Ks'],
    board: ['7s', '4s', '2d'],
    groups: [
      { title: 'Any remaining spade completes the flush (9)', cards: spades(['Q', 'J', 'T', '9', '8', '6', '5', '3', '2']), struck: [] },
    ],
    note: '13 spades in the deck, minus the 4 you can see (two in your hand, two on the board) = 9 outs.',
  },
  {
    key: 'oesd',
    label: 'Open-ended straight draw',
    outs: 8,
    hole: ['Jh', 'Td'],
    board: ['Qs', '9c', '3d'],
    groups: [
      { title: 'Either end fills the straight (8)', cards: [...allSuits('K'), ...allSuits('8')], struck: [] },
    ],
    note: 'K-Q-J-T-9 or Q-J-T-9-8: any king or any eight — four of each.',
  },
  {
    key: 'gutshot',
    label: 'Gutshot',
    outs: 4,
    hole: ['Jh', 'Td'],
    board: ['Qs', '8c', '3d'],
    groups: [
      { title: 'Only the inside card works (4)', cards: allSuits('9'), struck: [] },
    ],
    note: 'Q-J-T-9-8 needs exactly a nine. One rank, four suits: 4 outs.',
  },
  {
    key: 'combo',
    label: 'Combo draw (flush + OESD)',
    outs: 15,
    hole: ['Ts', '9s'],
    board: ['Js', '8s', '2d'],
    groups: [
      { title: 'Flush outs (9)', cards: spades(['A', 'K', 'Q', '7', '6', '5', '4', '3', '2']), struck: [] },
      { title: 'Straight outs (8) — but two are already counted', cards: [...allSuits('Q'), ...allSuits('7')], struck: ['Qs', '7s'] },
    ],
    note: '9 flush outs + 8 straight outs − the 2 straight-flush cards (Q♠, 7♠) counted twice = 15 clean outs. Adding 9 + 8 = 17 is the classic mistake.',
  },
];

const OutChip = ({ card, struck }) => {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-xs font-bold tabular-nums ${
        struck
          ? 'bg-rose-500/5 border-rose-500/30 line-through decoration-rose-400/80 opacity-70'
          : 'bg-slate-800/80 border-slate-700'
      }`}
    >
      <span className="text-slate-100">{rank}</span>
      <span className={SUIT_COLORS[suit]}>{SUIT_SYMBOLS[suit]}</span>
    </span>
  );
};

const OutsGallery = () => {
  const [active, setActive] = useState('flush');
  const preset = PRESETS.find((p) => p.key === active);

  return (
    <WidgetFrame title="Try it: the standard draws, out by out">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(p.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
              active === p.key
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            {p.label} · {p.outs}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-6 items-center">
        <div>
          <span className="text-slate-500 text-xs font-bold block mb-1">YOUR HAND</span>
          <div className="flex gap-1.5">
            {preset.hole.map((c) => <PokerCard key={c} value={c} />)}
          </div>
        </div>
        <div>
          <span className="text-slate-500 text-xs font-bold block mb-1">FLOP</span>
          <div className="flex gap-1.5">
            {preset.board.map((c) => <PokerCard key={c} value={c} />)}
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Outs</span>
          <span className="text-2xl font-bold text-indigo-300 tabular-nums">{preset.outs}</span>
        </div>
      </div>

      <div className="space-y-3">
        {preset.groups.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold text-slate-400 mb-1.5">{group.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.cards.map((c) => (
                <OutChip key={c} card={c} struck={group.struck.includes(c)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{preset.note}</p>
    </WidgetFrame>
  );
};

export default OutsGallery;
