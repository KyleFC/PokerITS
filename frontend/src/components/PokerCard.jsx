import React from 'react';

// Renders a single playing card from a string like "As", "Kh", "Td", "2c".
const PokerCard = ({ value }) => {
  if (!value) return null;
  const rank = value.slice(0, -1);
  const suit = value.slice(-1);

  const suitSymbols = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  };

  const suitColors = {
    s: 'text-slate-300',
    h: 'text-rose-500',
    d: 'text-blue-500',
    c: 'text-emerald-500',
  };

  return (
    <div className="w-11 h-16 bg-white border border-slate-200 rounded-lg flex flex-col justify-between p-1.5 shadow-md shrink-0">
      <span className="text-xs font-bold leading-none select-none text-slate-900">{rank}</span>
      <span className={`text-xl font-bold self-center leading-none select-none ${suitColors[suit] || 'text-slate-900'}`}>
        {suitSymbols[suit] || suit}
      </span>
      <span className="text-xs font-bold leading-none select-none text-slate-900 rotate-180 self-end">{rank}</span>
    </div>
  );
};

export default PokerCard;
