import React from 'react';

// Renders a single playing card from a string like "As", "Kh", "Td", "2c".
// Unknown cards (any value containing "?", e.g. a hidden villain hand) render
// as a face-down card back.
const PokerCard = ({ value }) => {
  if (!value) return null;

  if (value.includes('?')) {
    return (
      <div className="w-11 h-16 rounded-lg shrink-0 shadow-md border border-indigo-900/60 bg-gradient-to-br from-indigo-800 to-slate-900 flex items-center justify-center">
        <div className="w-7 h-12 rounded border border-indigo-500/30 bg-[repeating-linear-gradient(45deg,rgba(99,102,241,0.25)_0_4px,transparent_4px_8px)]" />
      </div>
    );
  }

  const rank = value.slice(0, -1);
  const suit = value.slice(-1);

  const suitSymbols = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  };

  const suitColors = {
    s: 'text-slate-900',
    h: 'text-rose-500',
    d: 'text-blue-500',
    c: 'text-emerald-500',
  };

  return (
    <div className="w-11 h-16 bg-white border border-slate-200 rounded-lg flex flex-col items-start p-1.5 shadow-md shrink-0">
      <span className="text-xs font-bold leading-none select-none text-slate-900">{rank}</span>
      <div className="flex-1 flex items-center justify-center w-full">
        <span className={`text-2xl font-bold leading-none select-none ${suitColors[suit] || 'text-slate-900'}`}>
          {suitSymbols[suit] || suit}
        </span>
      </div>
    </div>
  );
};

export default PokerCard;
