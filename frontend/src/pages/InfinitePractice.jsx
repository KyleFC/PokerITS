import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Infinity as InfinityIcon, RefreshCw, XCircle, ArrowRight, Target, Zap } from 'lucide-react';
import { pokerService, studentService } from '../services/api';
import { SKILL_LABELS, GENERATABLE_SKILLS, MASTERY_THRESHOLD } from '../constants';
import PageLayout from '../components/PageLayout';
import PokerCard from '../components/PokerCard';
import QuizResultPanel from '../components/QuizResultPanel';

// Adaptive mode + one entry per generatable skill.
const SKILL_TABS = [
  { key: '', label: 'Adaptive' },
  ...GENERATABLE_SKILLS.map((key) => ({ key, label: SKILL_LABELS[key] || key })),
];

const emptyStats = { answered: 0, correct: 0, streak: 0, bestStreak: 0 };

// Infinite practice: a never-ending stream of procedurally generated quizzes.
// Each question is fetched from the server (answer key stripped), graded
// server-side, and the grading response carries the updated BKT profile — so
// mastery bars move in real time without a separate profile fetch.
const InfinitePractice = ({ user, onLogout }) => {
  const [skillFilter, setSkillFilter] = useState('');
  const [scenario, setScenario] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedOption, setSelectedOption] = useState('');
  const [result, setResult] = useState(null); // server grading response, or null
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState(emptyStats);

  // Guards against a stale in-flight fetch resolving after the filter changed.
  const fetchToken = useRef(0);

  const loadNext = useCallback(async (skill) => {
    const token = ++fetchToken.current;
    setLoading(true);
    setError('');
    setResult(null);
    setSelectedOption('');
    try {
      const next = await pokerService.generateScenario(skill);
      if (token === fetchToken.current) setScenario(next);
    } catch (err) {
      if (token === fetchToken.current) setError('Could not generate a new question. Please try again.');
    } finally {
      if (token === fetchToken.current) setLoading(false);
    }
  }, []);

  // Load the profile once for the initial mastery display; thereafter the
  // grading response keeps it current.
  useEffect(() => {
    studentService.getProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    loadNext(skillFilter);
  }, [skillFilter, loadNext]);

  const handleSubmit = async () => {
    if (!selectedOption || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const graded = await studentService.submitQuizResult(scenario.id, selectedOption);
      setResult(graded);
      setProfile(graded.profile);
      setStats((s) => {
        const streak = graded.correct ? s.streak + 1 : 0;
        return {
          answered: s.answered + 1,
          correct: s.correct + (graded.correct ? 1 : 0),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      });
    } catch (err) {
      setError('Failed to record result with the BKT engine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitted = result !== null;
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  const activeSkill = scenario?.skill;
  const activeMastery = profile && activeSkill != null ? profile.skills?.[activeSkill] : null;

  const optionButtonClass = (opt) => {
    const isSelected = selectedOption === opt;
    if (submitted) {
      if (opt === result.correct_answer) return 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400';
      if (isSelected) return 'border-rose-500/50 bg-rose-500/5 text-rose-400';
      return 'border-slate-900 bg-slate-950/10 text-slate-600 opacity-60';
    }
    if (isSelected) return 'border-indigo-500/80 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-500/10';
    return 'border-slate-850 bg-slate-950/30 hover:border-slate-700 text-slate-300 cursor-pointer';
  };

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <InfinityIcon className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Infinite Practice</h2>
            <p className="text-slate-400 mt-1 text-sm max-w-xl leading-relaxed">
              Endless, procedurally generated drills. Every answer updates your BKT skill mastery.
            </p>
          </div>
        </div>
        {/* Session stats */}
        <div className="flex gap-3">
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-3 rounded-2xl text-center shadow-inner min-w-[72px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block">Answered</span>
            <span className="text-lg font-bold text-slate-200">{stats.answered}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-3 rounded-2xl text-center shadow-inner min-w-[72px]">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block">Accuracy</span>
            <span className="text-lg font-bold text-slate-200">{accuracy}%</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-3 rounded-2xl text-center shadow-inner min-w-[72px]">
            <span className="text-xs text-amber-500/80 uppercase tracking-wider font-bold flex items-center justify-center gap-1">
              <Zap className="h-3 w-3" /> Streak
            </span>
            <span className="text-lg font-bold text-slate-200">{stats.streak}</span>
          </div>
        </div>
      </section>

      {/* Skill selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <Target className="h-4 w-4" /> Focus
        </span>
        {SKILL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSkillFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition cursor-pointer ${
              skillFilter === tab.key
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {error && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-sm p-4 flex items-center gap-2">
            <XCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading || !scenario ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin" />
            <p className="text-slate-400 text-sm font-medium">Generating a fresh hand...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-6">
            {/* Skill + live mastery */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/15">
                {SKILL_LABELS[activeSkill] || activeSkill?.replace('_', ' ')}
              </span>
              {activeMastery != null && (
                <div className="flex items-center gap-2 min-w-[180px]">
                  <span className="text-xs text-slate-500 font-semibold">Mastery</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeMastery >= MASTERY_THRESHOLD ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.round(activeMastery * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-300 tabular-nums w-9 text-right">
                    {Math.round(activeMastery * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Context: hand, board, stacks */}
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
                {scenario.pot_size_bb != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 font-medium">Pot Size:</span>
                    <span className="text-slate-200 font-bold">{scenario.pot_size_bb} BB</span>
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

            {/* Prompt */}
            <div className="text-slate-200 leading-relaxed text-sm md:text-base border-l-2 border-indigo-500 pl-4 py-1">
              {scenario.description}
            </div>

            {/* Options — sentence-length answers (e.g. implied odds) read
                better stacked full-width; short ones stay in a 2-col grid. */}
            <div className={`grid gap-3 ${scenario.options.some((o) => o.length > 30) ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {scenario.options.map((opt) => (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setSelectedOption(opt)}
                  className={`p-4 rounded-xl border font-bold text-sm transition ${
                    opt.length > 30 ? 'text-left' : 'text-center'
                  } ${optionButtonClass(opt)}`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {submitted && <QuizResultPanel result={result} />}

            {/* Actions */}
            <div className="flex justify-end pt-1">
              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedOption}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-98 flex items-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? 'Submitting...' : 'Submit Answer'}
                </button>
              ) : (
                <button
                  onClick={() => loadNext(skillFilter)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition transform active:scale-98 flex items-center gap-2 cursor-pointer text-sm"
                >
                  Next Question <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default InfinitePractice;
