import React from 'react';
import { Info, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';

// Shared prose building blocks for Learning Center lessons. All hand-written
// Tailwind JSX (no markdown pipeline), matching the Tutorial page's styling so
// the curriculum reads as one system.

// One anchored lesson section. The id must match the lesson's `sections`
// entry in lessons/meta.js — it is the stable deep-link target
// (/learn/<slug>#<id>) used by the sidebar, quiz feedback and, later, the
// LLM tutor. scroll-mt keeps anchored headings clear of the sticky header.
export const LessonSection = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-24 space-y-4">
    <h3 className="font-bold text-lg text-white pt-2">{title}</h3>
    {children}
  </section>
);

const CALLOUT_TONES = {
  info: {
    box: 'bg-slate-800/40 border-slate-700',
    title: 'text-indigo-300',
    Icon: Info,
    icon: 'text-indigo-400',
  },
  warn: {
    box: 'bg-amber-500/5 border-amber-500/30',
    title: 'text-amber-300',
    Icon: AlertTriangle,
    icon: 'text-amber-400',
  },
  key: {
    box: 'bg-indigo-500/10 border-indigo-500/30',
    title: 'text-indigo-200',
    Icon: Lightbulb,
    icon: 'text-indigo-300',
  },
};

export const Callout = ({ tone = 'info', title, children }) => {
  const { box, title: titleColor, Icon, icon } = CALLOUT_TONES[tone] || CALLOUT_TONES.info;
  return (
    <div className={`border rounded-lg p-5 space-y-2 ${box}`}>
      {title && (
        <p className={`font-semibold text-sm flex items-center gap-2 ${titleColor}`}>
          <Icon className={`h-4 w-4 shrink-0 ${icon}`} />
          {title}
        </p>
      )}
      <div className="text-sm text-slate-300 leading-relaxed space-y-2">{children}</div>
    </div>
  );
};

// A formula block: monospace statement in a flat tinted card, matching the
// Tutorial's pot-odds box.
export const Formula = ({ children, note }) => (
  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-5">
    <p className="font-mono text-sm md:text-base text-indigo-200 font-semibold">{children}</p>
    {note && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{note}</p>}
  </div>
);

// Numbered worked example. Compose with <Step n={1}>...</Step> children.
export const WorkedExample = ({ title, children }) => (
  <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-5 space-y-3">
    <p className="font-semibold text-sm text-slate-100">{title}</p>
    <div className="space-y-3">{children}</div>
  </div>
);

export const Step = ({ n, children }) => (
  <div className="flex gap-3 text-sm">
    <span className="text-indigo-400 font-bold min-w-5 text-right shrink-0">{n}.</span>
    <div className="text-slate-300 leading-relaxed">{children}</div>
  </div>
);

// Closing takeaway card, used at the end of every lesson.
export const KeyTakeaways = ({ items }) => (
  <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-lg p-5 space-y-3">
    <p className="font-semibold text-sm text-emerald-300 flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Key takeaways
    </p>
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
          <span className="text-emerald-400 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);
