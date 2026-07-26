import React from 'react';
import { RefreshCw, XCircle } from 'lucide-react';

// Small shared pieces for the admin pages, kept here so the five dashboard
// screens look like one product rather than five.

export const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${className}`}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          {title && <h3 className="font-bold text-slate-100">{title}</h3>}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const StatCard = ({ label, value, hint, tone = 'default' }) => {
  const tones = {
    default: 'text-slate-100',
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-rose-400',
    accent: 'text-indigo-300',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${tones[tone] || tones.default}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
};

export const LoadingState = ({ message = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
    <p className="text-slate-400 font-medium">{message}</p>
  </div>
);

export const ErrorBanner = ({ message }) =>
  message ? (
    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2 mb-6">
      <XCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

export const EmptyState = ({ children }) => (
  <div className="py-12 text-center text-sm text-slate-500 italic">{children}</div>
);

// Compact mastery bar. Amber below the remediation floor, emerald at mastery,
// indigo in between — the same read the student's own dashboard gives, so an
// instructor and a student describe a skill the same way.
export const MasteryBar = ({ value, mastered }) => {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  const color = mastered
    ? 'bg-emerald-500'
    : pct < 30
      ? 'bg-amber-500'
      : 'bg-indigo-500';
  return (
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden" title={`${pct.toFixed(0)}%`}>
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Pill = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'text-slate-400 bg-slate-800/60 border-slate-700',
    good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    warn: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    bad: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    accent: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  };
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
};

export const pct = (value, places = 0) =>
  value == null ? '—' : `${(value * 100).toFixed(places)}%`;

export const relativeTime = (iso) => {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};
