import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

// Shared chrome for every interactive lesson widget: a distinct "try it"
// surface inside the prose so students can tell explorable math from text.
const WidgetFrame = ({ title, children }) => (
  <div className="bg-slate-950/50 border border-indigo-500/25 rounded-2xl p-5 space-y-4">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {title}
    </p>
    {children}
  </div>
);

// Native range input, styled to match the app's indigo accent.
export const Slider = ({ label, value, display, min, max, step, onChange }) => (
  <label className="block">
    <span className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
      <span>{label}</span>
      <span className="text-slate-200 font-bold tabular-nums">{display}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer"
      style={{ accentColor: '#6366f1' }}
    />
  </label>
);

// Small labeled read-out tile.
export const Readout = ({ label, value, tone = 'neutral' }) => {
  const tones = {
    neutral: 'text-slate-200',
    good: 'text-emerald-400',
    bad: 'text-rose-400',
    warn: 'text-amber-400',
    accent: 'text-indigo-300',
  };
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center min-w-[96px]">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${tones[tone] || tones.neutral}`}>{value}</span>
    </div>
  );
};

export default WidgetFrame;
