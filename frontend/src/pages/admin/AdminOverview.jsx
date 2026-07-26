import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, Line,
} from 'recharts';
import { Users, Download, ArrowRight } from 'lucide-react';
import { adminService } from '../../services/api';
import { CHART } from '../../constants';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Panel, StatCard, LoadingState, ErrorBanner, pct,
} from '../../components/admin/primitives';

const SOURCE_LABELS = {
  quiz: 'Diagnostic quizzes',
  infinite: 'Infinite practice',
  hand: 'Live hands',
  exploit: 'Exploit Lab',
};

// Per-skill mastery distribution. A histogram rather than a mean, because a
// cohort split into "got it" and "lost" has the same average as one clustered in
// the middle, and those two situations call for opposite teaching responses.
const MasteryHistogram = ({ skill }) => {
  const data = skill.histogram.map((n, i) => ({
    bucket: skill.histogram_labels[i],
    students: n,
  }));
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="bucket"
            stroke={CHART.axis}
            tick={{ fill: CHART.axis, fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            interval={0}
          />
          <YAxis
            stroke={CHART.axis}
            tick={{ fill: CHART.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#020617', border: '1px solid #334155',
              borderRadius: 8, fontSize: 12,
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="students" fill={CHART.primary} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ActivityChart = ({ activity }) => (
  <div className="h-56">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={activity} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date"
          stroke={CHART.axis}
          tick={{ fill: CHART.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: CHART.grid }}
          tickFormatter={(d) => d.slice(5)}
          minTickGap={20}
        />
        <YAxis
          stroke={CHART.axis}
          tick={{ fill: CHART.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#020617', border: '1px solid #334155',
            borderRadius: 8, fontSize: 12,
          }}
          labelStyle={{ color: '#e2e8f0' }}
        />
        <Bar dataKey="observations" name="Graded answers" fill={CHART.primary} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="hands"
          name="Hands played"
          stroke={CHART.results}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

const AdminOverview = ({ user, onLogout }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    adminService
      .getOverview(30)
      .then(setData)
      .catch(() => setError('Failed to load cohort overview.'))
      .finally(() => setLoading(false));
  }, []);

  const download = async (dataset) => {
    setExporting(dataset);
    try {
      await adminService.downloadExport(dataset);
    } catch {
      setError(`Failed to export ${dataset}.`);
    } finally {
      setExporting('');
    }
  };

  if (loading) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <LoadingState message="Aggregating cohort data…" />
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <ErrorBanner message={error || 'No data available.'} />
      </AdminLayout>
    );
  }

  const { users, observations, play, skills, activity } = data;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Cohort Overview
          </h2>
          <p className="text-slate-400 mt-1 text-sm max-w-3xl leading-relaxed">
            Everything the student model has recorded, across every account.
            Generated {new Date(data.generated_at).toLocaleString()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['observations', 'hands', 'users'].map((dataset) => (
            <button
              key={dataset}
              onClick={() => download(dataset)}
              disabled={!!exporting}
              className="text-xs font-semibold text-slate-300 border border-slate-700 hover:border-amber-500/50 hover:text-amber-300 px-3 py-2 rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === dataset ? 'Exporting…' : `${dataset} CSV`}
            </button>
          ))}
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Accounts"
          value={users.total}
          hint={`${users.staff} staff · ${users.new_7d} new this week`}
        />
        <StatCard
          label="Engaged"
          value={users.engaged}
          tone="accent"
          hint="answered ≥ 1 question"
        />
        <StatCard
          label="Active (7d)"
          value={users.active_7d}
          tone={users.active_7d > 0 ? 'good' : 'warn'}
          hint={`${users.active_30d} in last 30d`}
        />
        <StatCard
          label="Graded answers"
          value={observations.total.toLocaleString()}
          hint={`${pct(observations.accuracy, 1)} correct`}
        />
        <StatCard
          label="Arena hands"
          value={play.arena_hands.toLocaleString()}
          hint={`${play.lab_hands.toLocaleString()} lab hands`}
        />
        <StatCard
          label="Lab matches"
          value={play.matches}
          hint={`${pct(play.match_completion_rate)} completed`}
        />
      </div>

      {/* Activity */}
      <Panel
        title="Daily activity — last 30 days"
        subtitle="Graded answers (bars) against hands played (line). Flat stretches are days nobody logged in, not missing data."
        className="mb-6"
      >
        <ActivityChart activity={activity} />
      </Panel>

      {/* Practice mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Panel
          title="Where answers come from"
          subtitle="Accuracy differs by source by design — live hands are graded against charts, quizzes against an answer key."
          className="lg:col-span-1"
        >
          <div className="space-y-3">
            {Object.entries(observations.by_source).length === 0 && (
              <p className="text-sm text-slate-500 italic">No graded answers yet.</p>
            )}
            {Object.entries(observations.by_source).map(([source, s]) => (
              <div key={source}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-300">{SOURCE_LABELS[source] || source}</span>
                  <span className="text-slate-400 tabular-nums text-xs">
                    {s.n.toLocaleString()} · {pct(s.accuracy, 1)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${(s.n / Math.max(1, observations.total)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Skill summary"
          subtitle="Mean mastery is the BKT posterior averaged over students who have a profile for that skill."
          className="lg:col-span-2"
          action={
            <Link
              to="/admin/curves"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1 shrink-0"
            >
              Learning curves <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="text-left font-semibold py-2">Skill</th>
                  <th className="text-right font-semibold py-2">Mean</th>
                  <th className="text-right font-semibold py-2">Mastered</th>
                  <th className="text-right font-semibold py-2">Answers</th>
                  <th className="text-right font-semibold py-2">Accuracy</th>
                  <th className="text-right font-semibold py-2">Guess rate</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => {
                  // Accuracy at or below the guess parameter means the item pool
                  // is teaching nothing measurable for that skill.
                  const atGuessFloor =
                    s.observations > 0 && s.params && s.accuracy <= s.params.p_g;
                  return (
                    <tr key={s.skill} className="border-b border-slate-800/60">
                      <td className="py-2 text-slate-200">{s.label}</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">
                        {pct(s.mean_mastery)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-300">
                        {s.mastered_students}/{s.students_with_profile}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-400">
                        {s.observations.toLocaleString()}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          atGuessFloor ? 'text-amber-400 font-semibold' : 'text-slate-300'
                        }`}
                        title={atGuessFloor ? 'At or below the guess rate — no signal' : undefined}
                      >
                        {pct(s.accuracy, 1)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-500">
                        {s.params ? pct(s.params.p_g) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mastery distributions */}
      <Panel
        title="Mastery distribution per skill"
        subtitle="How many students sit in each mastery band. Two clusters at the extremes need a different intervention than one hump in the middle."
        action={
          <Link
            to="/admin/users"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1 shrink-0"
          >
            <Users className="h-3.5 w-3.5" /> Student roster
          </Link>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {skills.map((s) => (
            <div key={s.skill}>
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-sm font-semibold text-slate-200">{s.label}</h4>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  n={s.students_with_profile}
                </span>
              </div>
              <MasteryHistogram skill={s} />
            </div>
          ))}
        </div>
      </Panel>
    </AdminLayout>
  );
};

export default AdminOverview;
