import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine,
} from 'recharts';
import { adminService } from '../../services/api';
import { CHART } from '../../constants';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Panel, LoadingState, ErrorBanner, EmptyState, pct,
} from '../../components/admin/primitives';

// Points where only one or two students remain are noise, not a downturn. They
// are drawn faintly rather than dropped so the thinning tail is visible as a
// tail instead of silently vanishing.
const MIN_TRUSTWORTHY_N = 5;

const CurveTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-slate-100">Attempt #{p.opportunity}</div>
      <div className="text-indigo-300">{(p.accuracy * 100).toFixed(1)}% correct</div>
      <div className="text-slate-400">
        {p.correct}/{p.n} answers
        {p.n < MIN_TRUSTWORTHY_N && ' — too few to trust'}
      </div>
    </div>
  );
};

const LearningCurve = ({ curve }) => {
  if (!curve.points.length) {
    return <EmptyState>No attempts recorded for this skill.</EmptyState>;
  }
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={curve.points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="opportunity"
            stroke={CHART.axis}
            tick={{ fill: CHART.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            allowDecimals={false}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            stroke={CHART.axis}
            tick={{ fill: CHART.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CurveTooltip />} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
          {curve.guess_rate != null && (
            <ReferenceLine
              y={curve.guess_rate}
              stroke={CHART.warn}
              strokeDasharray="4 4"
              label={{
                value: 'Guess rate', position: 'insideBottomRight',
                fill: CHART.warn, fontSize: 10,
              }}
            />
          )}
          {curve.ceiling != null && (
            <ReferenceLine
              y={curve.ceiling}
              stroke={CHART.good}
              strokeDasharray="4 4"
              label={{
                value: 'Ceiling', position: 'insideTopRight',
                fill: CHART.good, fontSize: 10,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="accuracy"
            stroke={CHART.primary}
            strokeWidth={2}
            dot={({ cx, cy, payload }) =>
              cx == null || cy == null ? null : (
                <circle
                  key={payload.opportunity}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={CHART.primary}
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  opacity={payload.n < MIN_TRUSTWORTHY_N ? 0.35 : 1}
                />
              )
            }
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// A crude read on whether the curve rises: accuracy over the first third of the
// (trustworthy) points against the last third. Not a fit — just enough to sort
// "climbing" from "flat" without an instructor eyeballing six charts.
const trend = (points) => {
  const usable = points.filter((p) => p.n >= MIN_TRUSTWORTHY_N);
  if (usable.length < 4) return null;
  const third = Math.max(1, Math.floor(usable.length / 3));
  const head = usable.slice(0, third);
  const tail = usable.slice(-third);
  const mean = (xs) => xs.reduce((a, p) => a + p.accuracy, 0) / xs.length;
  return mean(tail) - mean(head);
};

const AdminCurves = ({ user, onLogout }) => {
  const [curves, setCurves] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService
      .getCurves(25)
      .then((data) => setCurves(data.curves))
      .catch(() => setError('Failed to load learning curves.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <LoadingState message="Building learning curves…" />
      </AdminLayout>
    );
  }

  if (!curves) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <ErrorBanner message={error || 'No data available.'} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Learning Curves
        </h2>
        <p className="text-slate-400 mt-1 text-sm max-w-4xl leading-relaxed">
          Cohort accuracy on every student&rsquo;s 1st attempt at a skill, 2nd attempt,
          and so on. This is the evidence that the tutor works:{' '}
          <strong className="text-slate-300">a curve that climbs is learning</strong>.
          A flat curve sitting at the guess rate means either the skill isn&rsquo;t being
          taught or its BKT parameters are miscalibrated, and mastery is drifting up on
          the transition parameter rather than on evidence. Later points pool fewer
          students, so faint dots mean too little data to read.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {curves.map((curve) => {
          const delta = trend(curve.points);
          const attempts = curve.points.reduce((a, p) => a + p.n, 0);
          return (
            <Panel
              key={curve.skill}
              title={curve.label}
              subtitle={`${attempts.toLocaleString()} graded attempts`}
              action={
                delta == null ? (
                  <span className="text-[11px] text-slate-500 shrink-0">
                    not enough data
                  </span>
                ) : (
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                      delta > 0.05
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : delta < -0.05
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : 'text-slate-400 bg-slate-800/60 border-slate-700'
                    }`}
                    title="Mean accuracy over the last third of trustworthy points minus the first third"
                  >
                    {delta > 0.05 ? '↑ climbing' : delta < -0.05 ? '↓ declining' : '→ flat'}
                    {' '}{delta > 0 ? '+' : ''}{pct(delta, 1)}
                  </span>
                )
              }
            >
              <LearningCurve curve={curve} />
            </Panel>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default AdminCurves;
