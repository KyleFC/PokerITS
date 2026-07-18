import React from 'react';
import { Link } from 'react-router-dom';
import { Check, BookOpen } from 'lucide-react';
import { LESSON_BY_SKILL } from '../lessons/meta';

// The graded-result reveal shared by the static QuizModal and the gameplay
// HandReplayModal. `result` is the server grading response:
// { correct, correct_answer, explanation, ev_notes, skill, profile }.
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
