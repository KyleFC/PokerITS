import React, { useState } from 'react';
import { CheckCircle, XCircle, Check } from 'lucide-react';
import { studentService } from '../services/api';
import PokerCard from './PokerCard';

// Inline diagnostic quiz overlay. Grading is done by the server: we submit the
// scenario id + chosen answer and render whatever verdict/answer key the
// backend returns. The correct answer is never known client-side beforehand.
const QuizModal = ({ scenario, onClose, onCompleted }) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // server grading response
  const [error, setError] = useState('');

  const submitted = result !== null;

  const handleSubmit = async () => {
    if (!selectedOption) return;
    setLoading(true);
    setError('');
    try {
      const graded = await studentService.submitQuizResult(scenario.id, selectedOption);
      setResult(graded);
    } catch (err) {
      setError('Failed to record result with BKT engine. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between relative">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/15">
              {scenario.skill.replace('_', ' ')}
            </span>
            <h3 className="font-extrabold text-lg text-white mt-2">{scenario.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/80 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-3 rounded-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cards & Stacks Context Panel */}
          <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-wrap gap-6 items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500 text-xs font-bold block mb-1">YOUR HAND</span>
                <div className="flex gap-1.5">
                  {scenario.hole_cards.map((c, i) => (
                    <PokerCard key={i} value={c} />
                  ))}
                </div>
              </div>
              {scenario.board?.length > 0 && (
                <div>
                  <span className="text-slate-500 text-xs font-bold block mb-1">BOARD</span>
                  <div className="flex gap-1.5">
                    {scenario.board.map((c, i) => (
                      <PokerCard key={i} value={c} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {scenario.position && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 font-medium">Position:</span>
                  <span className="text-slate-200 font-bold">{scenario.position}</span>
                </div>
              )}
              {scenario.pot_size_bb && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 font-medium">Pot Size:</span>
                  <span className="text-slate-200 font-bold">{scenario.pot_size_bb} BB</span>
                </div>
              )}
              {scenario.stack_size_bb && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 font-medium">Stack Size:</span>
                  <span className="text-slate-200 font-bold">{scenario.stack_size_bb} BB</span>
                </div>
              )}
              {scenario.villain_action && (
                <div className="col-span-2 border-t border-slate-850 pt-1.5 mt-1 flex gap-2">
                  <span className="text-slate-500 font-medium shrink-0">Action:</span>
                  <span className="text-slate-200 font-bold italic line-clamp-1">{scenario.villain_action}</span>
                </div>
              )}
            </div>
          </div>

          {/* Question */}
          <div className="text-slate-200 leading-relaxed text-sm md:text-base border-l-2 border-indigo-500 pl-4 py-1">
            {scenario.description}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <span className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Select Your Action</span>
            {scenario.options.map((opt) => {
              const isSelected = selectedOption === opt;
              let btnClass = 'border-slate-850 bg-slate-950/30 hover:border-slate-700 text-slate-300';

              if (submitted) {
                if (opt === result.correct_answer) {
                  btnClass = 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400';
                } else if (isSelected) {
                  btnClass = 'border-rose-500/50 bg-rose-500/5 text-rose-400';
                } else {
                  btnClass = 'border-slate-900 bg-slate-950/10 text-slate-600 opacity-60';
                }
              } else if (isSelected) {
                btnClass = 'border-indigo-500/80 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-500/10';
              }

              return (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setSelectedOption(opt)}
                  className={`w-full text-left p-4 rounded-xl border font-semibold flex items-center justify-between gap-4 transition duration-200 ${btnClass} ${!submitted && 'cursor-pointer'}`}
                >
                  <span className="text-sm">{opt}</span>
                  {submitted && opt === result.correct_answer && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />}
                  {submitted && isSelected && opt !== result.correct_answer && <XCircle className="h-5 w-5 text-rose-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation Reveal */}
          {submitted && (
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
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
          {!submitted ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !selectedOption}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-98 flex items-center gap-2 cursor-pointer text-sm"
              >
                {loading ? 'Submitting...' : 'Submit Answer'}
              </button>
            </>
          ) : (
            <button
              onClick={onCompleted}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition transform active:scale-98 cursor-pointer text-sm"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
