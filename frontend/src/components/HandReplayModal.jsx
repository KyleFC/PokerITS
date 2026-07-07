import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, Play, Pause, SkipForward, RotateCcw, RefreshCw } from 'lucide-react';
import { studentService, pokerService } from '../services/api';
import PokerTable from './PokerTable';
import QuizResultPanel from './QuizResultPanel';
import QuizModal from './QuizModal';

const FRAME_MS = 1100;

// Infer a button accent for an action-type option purely from its label. This
// is cosmetic only — grading is always done server-side against the exact
// option string.
const actionAccent = (option) => {
  const o = option.toLowerCase();
  if (o.includes('fold')) return 'fold';
  if (o.includes('raise') || o.includes('bet') || o.includes('3-bet') || o.includes('shove') || o.includes('all-in')) return 'raise';
  return 'call';
};

// Plays a scenario's scripted lead-up on a poker table, pauses at the decision
// point, collects the user's answer, and shows server-graded feedback. If the
// scenario has no gameplay script (replay 404s), it transparently falls back to
// the static QuizModal so every scenario stays playable.
const HandReplayModal = ({ scenario, onClose, onCompleted }) => {
  const [replay, setReplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const [selectedOption, setSelectedOption] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    pokerService
      .getScenarioReplay(scenario.id)
      .then((data) => {
        if (!active) return;
        setReplay(data);
        setLoading(false);
      })
      .catch(() => {
        // No gameplay script (or any fetch error): degrade to the static quiz.
        if (!active) return;
        setFallback(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scenario.id]);

  const lastIndex = replay ? replay.frames.length - 1 : 0;
  const atDecision = replay && frameIndex >= lastIndex;

  // Auto-advance one frame at a time while playing.
  useEffect(() => {
    if (!replay || !playing || atDecision) return;
    timerRef.current = setTimeout(() => setFrameIndex((i) => Math.min(i + 1, lastIndex)), FRAME_MS);
    return () => clearTimeout(timerRef.current);
  }, [replay, playing, frameIndex, atDecision, lastIndex]);

  // Stop playback once the decision point is reached.
  useEffect(() => {
    if (atDecision) setPlaying(false);
  }, [atDecision]);

  const skipToDecision = useCallback(() => {
    clearTimeout(timerRef.current);
    setPlaying(false);
    setFrameIndex(lastIndex);
  }, [lastIndex]);

  const replayHand = useCallback(() => {
    clearTimeout(timerRef.current);
    setFrameIndex(0);
    setPlaying(true);
  }, []);

  const handleSubmit = async () => {
    if (!selectedOption) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const graded = await studentService.submitQuizResult(scenario.id, selectedOption);
      setResult(graded);
    } catch (err) {
      setSubmitError('Failed to record result with BKT engine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Scenario without a scripted hand — use the original quiz experience.
  if (fallback) {
    return <QuizModal scenario={scenario} onClose={onClose} onCompleted={onCompleted} />;
  }

  const submitted = result !== null;
  const questionType = replay?.question_type;

  const optionButtonClass = (opt) => {
    const isSelected = selectedOption === opt;
    if (submitted) {
      if (opt === result.correct_answer) return 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400';
      if (isSelected) return 'border-rose-500/50 bg-rose-500/5 text-rose-400';
      return 'border-slate-900 bg-slate-950/10 text-slate-600 opacity-60';
    }
    if (isSelected) return 'border-indigo-500/80 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-500/10';
    return 'border-slate-850 bg-slate-950/30 hover:border-slate-700 text-slate-300';
  };

  const actionButtonClass = (opt) => {
    const accent = actionAccent(opt);
    const isSelected = selectedOption === opt;
    if (submitted) {
      if (opt === result.correct_answer) return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300';
      if (isSelected) return 'border-rose-500/60 bg-rose-500/10 text-rose-300';
      return 'border-slate-800 bg-slate-950/40 text-slate-600 opacity-60';
    }
    const base = {
      fold: 'border-rose-600/40 hover:border-rose-500 text-rose-300 bg-rose-500/5',
      call: 'border-slate-700 hover:border-slate-500 text-slate-200 bg-slate-800/40',
      raise: 'border-indigo-600/50 hover:border-indigo-500 text-indigo-300 bg-indigo-500/10',
    }[accent];
    const ring = isSelected ? ' ring-2 ring-offset-0 ring-indigo-400/40 border-indigo-400' : '';
    return base + ring;
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
        <div className="p-6 space-y-5 flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Dealing the hand...</p>
            </div>
          )}

          {submitError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-3 rounded-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {replay && (
            <>
              <PokerTable
                frame={replay.frames[frameIndex]}
                seats={replay.seats}
                hero={replay.hero}
                button={replay.button}
              />

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-2">
                {!atDecision ? (
                  <>
                    <button
                      onClick={() => setPlaying((p) => !p)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition"
                    >
                      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {playing ? 'Pause' : 'Play'}
                    </button>
                    <button
                      onClick={skipToDecision}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition"
                    >
                      <SkipForward className="h-3.5 w-3.5" /> Skip to decision
                    </button>
                  </>
                ) : (
                  <button
                    onClick={replayHand}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Replay hand
                  </button>
                )}
              </div>

              {/* Decision UI */}
              {atDecision && (
                <div className="border-t border-slate-800 pt-5 space-y-4">
                  {questionType === 'concept' && (
                    <div className="text-slate-200 leading-relaxed text-sm border-l-2 border-indigo-500 pl-4 py-1">
                      {scenario.question}
                    </div>
                  )}

                  {questionType === 'action' ? (
                    <div>
                      <span className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 text-center">
                        Your action
                      </span>
                      <div className="flex flex-wrap justify-center gap-3">
                        {scenario.options.map((opt) => (
                          <button
                            key={opt}
                            disabled={submitted}
                            onClick={() => setSelectedOption(opt)}
                            className={`px-5 py-3 rounded-xl border font-bold text-sm transition ${actionButtonClass(opt)} ${!submitted && 'cursor-pointer'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                        Select your answer
                      </span>
                      {scenario.options.map((opt) => (
                        <button
                          key={opt}
                          disabled={submitted}
                          onClick={() => setSelectedOption(opt)}
                          className={`w-full text-left p-4 rounded-xl border font-semibold flex items-center justify-between gap-4 transition ${optionButtonClass(opt)} ${!submitted && 'cursor-pointer'}`}
                        >
                          <span className="text-sm">{opt}</span>
                          {submitted && opt === result.correct_answer && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />}
                          {submitted && selectedOption === opt && opt !== result.correct_answer && <XCircle className="h-5 w-5 text-rose-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {submitted && <QuizResultPanel result={result} />}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
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
                disabled={submitting || !selectedOption || !atDecision}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-98 flex items-center gap-2 cursor-pointer text-sm"
              >
                {submitting ? 'Submitting...' : 'Submit Answer'}
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

export default HandReplayModal;
