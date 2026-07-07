import React from 'react';
import { Check } from 'lucide-react';

// The graded-result reveal shared by the static QuizModal and the gameplay
// HandReplayModal. `result` is the server grading response:
// { correct, correct_answer, explanation, ev_notes, skill, profile }.
const QuizResultPanel = ({ result }) => {
  if (!result) return null;
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
    </div>
  );
};

export default QuizResultPanel;
