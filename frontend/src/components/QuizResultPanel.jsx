import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { LESSON_BY_SKILL } from '../lessons/meta';

// Worked steps behind the answer, as supplied by the generator's `breakdown`.
// Shown open on a missed question — following one dense explanation paragraph
// is exactly what students reported struggling with when they got it wrong —
// and collapsed on a correct one, where it is reference rather than remedy.
const Breakdown = ({ steps, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-900 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? 'Hide' : 'Show'} the step-by-step math
      </button>
      {open && (
        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-850 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-300">
                  <span className="text-slate-600 tabular-nums mr-1.5">{i + 1}.</span>
                  {step.label}
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5 break-words">{step.formula}</p>
              </div>
              <span className="text-sm font-bold text-indigo-300 tabular-nums shrink-0">{step.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// The graded-result reveal shared by the static QuizModal and the gameplay
// HandReplayModal. `result` is the server grading response:
// { correct, correct_answer, explanation, ev_notes, breakdown, skill, profile }.
const QuizResultPanel = ({ result }) => {
  if (!result) return null;
  const lesson = LESSON_BY_SKILL[result.skill];
  return (
    <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3 animate-fadeIn">
      <div className="flex items-center gap-2">
        {result.correct ? (
          <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-500/10 flex items-center gap-1">
            <Check className="h-3 w-3" /> Correct Answer
          </span>
        ) : (
          <span className="bg-rose-500/15 text-rose-400 text-xs font-bold px-2.5 py-1 rounded-md border border-rose-500/10">
            Incorrect Answer
          </span>
        )}
      </div>
      <h4 className="font-bold text-slate-200 text-sm">Strategic Explanation</h4>
      <p className="text-slate-400 text-sm leading-relaxed">{result.explanation}</p>
      {result.ev_notes && (
        <p className="text-slate-500 text-xs italic mt-2 border-t border-slate-900 pt-2">{result.ev_notes}</p>
      )}
      {result.breakdown?.length > 0 && (
        <Breakdown
          // Remount (and so reset the open/closed default) when the graded
          // question changes, rather than carrying the last one's toggle state.
          key={result.correct_answer}
          steps={result.breakdown}
          defaultOpen={!result.correct}
        />
      )}
      {/* Explanations shouldn't be dead ends: link the skill's lesson so a
          student who didn't follow the math has somewhere to go besides
          another drill. */}
      {lesson && (
        <Link
          to={`/learn/${lesson.slug}`}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1.5 pt-1"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          Learn more: {lesson.shortTitle}
        </Link>
      )}
    </div>
  );
};

export default QuizResultPanel;
