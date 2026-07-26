import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { adminService } from '../../services/api';
import { SKILL_LABELS, MASTERY_THRESHOLD, REMEDIATION_THRESHOLD } from '../../constants';
import AdminLayout from '../../components/admin/AdminLayout';
import SkillTimelineChart from '../../components/analytics/SkillTimelineChart';
import HandReviewList from '../../components/analytics/HandReviewList';
import {
  Panel, StatCard, LoadingState, ErrorBanner, EmptyState, Pill, pct, relativeTime,
} from '../../components/admin/primitives';

const SOURCE_LABELS = {
  quiz: 'Diagnostic quizzes',
  infinite: 'Infinite practice',
  hand: 'Live hands',
  exploit: 'Exploit Lab',
};

const PHASE_LABELS = {
  scout: 'Scout', diagnosis: 'Diagnosis', exploit: 'Exploit', complete: 'Complete',
};

const AdminUserDetail = ({ user, onLogout }) => {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    adminService
      .getUser(userId)
      .then(setData)
      .catch((err) => setError(
        err?.response?.status === 404
          ? 'No such student.'
          : 'Failed to load this student.'
      ))
      .finally(() => setLoading(false));
  }, [userId]);

  // Split the flat observation log per skill once, so each timeline gets a
  // stable array and the memoized chart doesn't re-render on unrelated state.
  const bySkill = useMemo(() => {
    const groups = Object.fromEntries(Object.keys(SKILL_LABELS).map((s) => [s, []]));
    for (const obs of data?.observations || []) {
      if (groups[obs.skill]) groups[obs.skill].push(obs);
    }
    return groups;
  }, [data]);

  if (loading) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <LoadingState message="Loading student record…" />
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <ErrorBanner message={error || 'No data available.'} />
        <Link to="/admin/users" className="text-sm text-amber-400 hover:text-amber-300">
          ← Back to roster
        </Link>
      </AdminLayout>
    );
  }

  const { user: student, skills, by_source: bySource, hand_stats: handStats,
          recent_hands: recentHands, matches, open_live_hands: openHands } = data;

  const weakest = [...skills]
    .filter((s) => s.observations > 0)
    .sort((a, b) => a.mastery - b.mastery)[0];

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <Link
        to="/admin/users"
        className="text-sm text-slate-400 hover:text-white transition inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to roster
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            {student.username}
            {student.is_staff && <Pill tone="warn">staff</Pill>}
            {!student.is_active && <Pill tone="bad">inactive</Pill>}
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            {student.email || 'no email'} · joined{' '}
            {new Date(student.date_joined).toLocaleDateString()} · last login{' '}
            {relativeTime(student.last_login)}
          </p>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Graded answers"
          value={data.observations.length}
          hint={
            data.observations.length >= 500
              ? 'showing the most recent 500'
              : 'complete history'
          }
        />
        <StatCard
          label="Skills mastered"
          value={`${skills.filter((s) => s.mastered).length}/${skills.length}`}
          tone={skills.some((s) => s.mastered) ? 'good' : 'default'}
        />
        <StatCard
          label="Weakest skill"
          value={weakest ? pct(weakest.mastery) : '—'}
          tone={weakest && weakest.mastery < REMEDIATION_THRESHOLD ? 'warn' : 'default'}
          hint={weakest ? weakest.label : 'no attempts yet'}
        />
        <StatCard label="Arena hands" value={handStats.hands_played} />
        <StatCard
          label="bb/100"
          value={handStats.hands_played ? handStats.bb_per_100.toFixed(1) : '—'}
          tone={handStats.bb_per_100 >= 0 ? 'good' : 'bad'}
          hint="results — variance-laden"
        />
        <StatCard
          label="EV loss / hand"
          value={handStats.hands_played ? `${handStats.ev_loss_per_hand_bb.toFixed(2)} bb` : '—'}
          tone="accent"
          hint="decision quality"
        />
      </div>

      {/* Skill table */}
      <Panel
        title="Skill breakdown"
        subtitle={`Mastery is the BKT posterior. A skill counts as mastered only above ${Math.round(MASTERY_THRESHOLD * 100)}% AND with at least 5 observations behind it — a high estimate on three lucky answers is not mastery.`}
        className="mb-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="text-left font-semibold py-2">Skill</th>
                <th className="text-right font-semibold py-2">Mastery</th>
                <th className="text-right font-semibold py-2">Prior</th>
                <th className="text-right font-semibold py-2">Answers</th>
                <th className="text-right font-semibold py-2">Correct</th>
                <th className="text-right font-semibold py-2">Accuracy</th>
                <th className="text-right font-semibold py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s) => (
                <tr key={s.skill} className="border-b border-slate-800/60">
                  <td className="py-2.5 text-slate-200">{s.label}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-slate-100">
                    {pct(s.mastery, 1)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-500">
                    {pct(s.prior)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-300">{s.observations}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-400">{s.correct}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-300">
                    {s.observations ? pct(s.accuracy, 1) : '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    {s.mastered ? (
                      <Pill tone="good">mastered</Pill>
                    ) : s.observations === 0 ? (
                      <Pill>untouched</Pill>
                    ) : s.mastery < REMEDIATION_THRESHOLD ? (
                      <Pill tone="warn">needs review</Pill>
                    ) : (
                      <Pill tone="accent">in progress</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Per-skill posterior timelines — the same component the student sees */}
      <section className="mb-6">
        <h3 className="font-bold text-slate-100 mb-1">Mastery timelines</h3>
        <p className="text-xs text-slate-500 mb-4 max-w-3xl leading-relaxed">
          Every graded decision in order, with the posterior it produced. Green dots
          are correct, red are incorrect — a dip in the line is tied to the answers
          that caused it. This is the same chart the student sees on their own
          Analytics page.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(SKILL_LABELS).map(([skill, label]) => {
            const obs = bySkill[skill] || [];
            const current = obs.length ? obs[obs.length - 1].posterior_after : null;
            return (
              <div key={skill} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-100 text-sm">{label}</h4>
                  {current != null && (
                    <span className="text-sm font-bold text-indigo-300 tabular-nums">
                      {pct(current)}
                    </span>
                  )}
                </div>
                <SkillTimelineChart observations={obs} />
                <p className="text-[11px] text-slate-500 mt-2">
                  {obs.length} graded decision{obs.length === 1 ? '' : 's'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Practice mix + Exploit Lab */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Practice mix" subtitle="Which parts of the system this student actually uses.">
          {Object.keys(bySource).length === 0 ? (
            <EmptyState>No graded answers yet.</EmptyState>
          ) : (
            <div className="space-y-3">
              {Object.entries(bySource).map(([source, s]) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{SOURCE_LABELS[source] || source}</span>
                  <span className="text-slate-400 tabular-nums text-xs">
                    {s.n} answers · {pct(s.accuracy, 1)} correct
                  </span>
                </div>
              ))}
            </div>
          )}
          {openHands > 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {openHands} unfinished live hand{openHands === 1 ? '' : 's'} — abandoned mid-hand.
            </div>
          )}
        </Panel>

        <Panel
          title="Exploit Lab matches"
          subtitle="Opponent-reading diagnoses. A match abandoned in the diagnosis phase is a student who couldn't commit to a read."
        >
          {matches.length === 0 ? (
            <EmptyState>No matches started.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="text-left font-semibold py-2">Started</th>
                    <th className="text-left font-semibold py-2">Difficulty</th>
                    <th className="text-left font-semibold py-2">Phase</th>
                    <th className="text-center font-semibold py-2">Read</th>
                    <th className="text-center font-semibold py-2">Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800/60">
                      <td className="py-2 text-slate-400 text-xs">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-slate-300 capitalize">{m.difficulty}</td>
                      <td className="py-2">
                        {m.phase === 'complete' ? (
                          <Pill tone="good">{PHASE_LABELS[m.phase]}</Pill>
                        ) : (
                          <Pill tone="warn">{PHASE_LABELS[m.phase] || m.phase}</Pill>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {m.read_correct == null ? (
                          <span className="text-slate-600">—</span>
                        ) : m.read_correct ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-rose-400">✗</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {m.adjustment_correct == null ? (
                          <span className="text-slate-600">—</span>
                        ) : m.adjustment_correct ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-rose-400">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Hand review — same component as the student's Analytics page */}
      <Panel
        title="Recent Arena hands"
        subtitle="Decision grades first, result last. A hand can be played perfectly and still lose — read the EV column, not the result column."
      >
        <HandReviewList hands={recentHands} />
      </Panel>
    </AdminLayout>
  );
};

export default AdminUserDetail;
