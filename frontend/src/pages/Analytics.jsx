import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart as LineChartIcon, RefreshCw, XCircle, History, ArrowRight } from 'lucide-react';
import { studentService, pokerService } from '../services/api';
import { SKILL_LABELS, MASTERY_THRESHOLD, REMEDIATION_THRESHOLD, isMastered } from '../constants';
import { LESSON_BY_SKILL } from '../lessons/meta';
import PageLayout from '../components/PageLayout';
import SkillTimelineChart from '../components/analytics/SkillTimelineChart';
import HandReviewList from '../components/analytics/HandReviewList';

// Module 4: analytics over the append-only SkillObservation log — how each
// BKT posterior evolved, observation by observation, not just where it sits
// now — plus a review list of completed Arena hands with their EV ground truth.
const Analytics = ({ user, onLogout }) => {
  const [observations, setObservations] = useState([]);
  const [hands, setHands] = useState([]);
  const [nextHandsPage, setNextHandsPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [history, handPage] = await Promise.all([
          studentService.getFullHistory(),
          pokerService.getHandHistory(),
        ]);
        setObservations(history);
        setHands(handPage.results);
        setNextHandsPage(handPage.next ? 2 : null);
      } catch {
        setError('Failed to load analytics data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadMoreHands = async () => {
    if (!nextHandsPage) return;
    setLoadingMore(true);
    try {
      const page = await pokerService.getHandHistory(nextHandsPage);
      setHands((prev) => [...prev, ...page.results]);
      setNextHandsPage(page.next ? nextHandsPage + 1 : null);
    } catch {
      setError('Failed to load more hands.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Group observations by skill in a single pass, memoized on `observations`
  // so unrelated state changes (loading more hands, error) don't re-run it or
  // hand fresh array identities to the charts and force them to re-render.
  const bySkill = useMemo(() => {
    const groups = Object.fromEntries(
      Object.keys(SKILL_LABELS).map((skill) => [skill, []])
    );
    for (const o of observations) {
      if (groups[o.skill]) groups[o.skill].push(o);
    }
    return Object.keys(SKILL_LABELS).map((skill) => ({
      skill,
      observations: groups[skill],
    }));
  }, [observations]);

  if (loading) {
    return (
      <PageLayout onLogout={onLogout} user={user}>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 font-medium">Charting your learning history...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex items-center gap-4">
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg">
          <LineChartIcon className="h-7 w-7 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Learning Analytics</h2>
          <p className="text-slate-400 mt-1 text-sm max-w-2xl leading-relaxed">
            How your mastery estimate has evolved with every graded decision.
            Green dots are correct decisions, red dots are leaks; cross the{' '}
            {Math.round(MASTERY_THRESHOLD * 100)}% line and a skill counts as mastered,
            fall below {Math.round(REMEDIATION_THRESHOLD * 100)}% and it needs focused review.
          </p>
        </div>
      </section>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2 mb-6">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Per-skill posterior timelines */}
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bySkill.map(({ skill, observations: obs }) => {
            const current = obs.length ? obs[obs.length - 1].posterior_after : null;
            const needsWork = current != null && current < REMEDIATION_THRESHOLD;
            // Gate mastery on evidence too: obs.length is this skill's
            // observation count, so a high posterior on a short streak isn't
            // shown as mastered.
            const mastered = isMastered(current, obs.length);
            return (
              <div key={skill} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-100">{SKILL_LABELS[skill]}</h3>
                  <div className="flex items-center gap-2">
                    {mastered && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        Mastered
                      </span>
                    )}
                    {needsWork && (
                      <>
                        <Link
                          to={`/practice?skill=${skill}`}
                          className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md hover:bg-amber-500/20 transition"
                        >
                          Needs review — drill it
                        </Link>
                        {LESSON_BY_SKILL[skill] && (
                          <Link
                            to={`/learn/${LESSON_BY_SKILL[skill].slug}`}
                            className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-md hover:bg-indigo-500/20 transition"
                          >
                            Read the lesson
                          </Link>
                        )}
                      </>
                    )}
                    {current != null && (
                      <span className="text-sm font-bold text-indigo-300 tabular-nums">
                        {(current * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <SkillTimelineChart observations={obs} />
                <p className="text-[11px] text-slate-500 mt-2">
                  {obs.length} graded decision{obs.length === 1 ? '' : 's'} across quizzes, drills and live hands
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hand review */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-100">Hand Review</h3>
          </div>
          <Link
            to="/arena/stats"
            className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
          >
            Arena session stats <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="text-sm text-slate-400 mb-4 max-w-3xl leading-relaxed">
          Every completed Arena hand with its decision grades. A hand can be
          played perfectly and still lose — that's variance. Focus on the
          EV column, not the result column.
        </p>
        <HandReviewList hands={hands} />
        {nextHandsPage && (
          <div className="flex justify-center mt-4">
            <button
              onClick={loadMoreHands}
              disabled={loadingMore}
              className="text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? 'Loading…' : 'Load more hands'}
            </button>
          </div>
        )}
      </section>
    </PageLayout>
  );
};

export default Analytics;
