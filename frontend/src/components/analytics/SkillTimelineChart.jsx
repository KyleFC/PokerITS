import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts';
import { CHART, MASTERY_THRESHOLD, REMEDIATION_THRESHOLD } from '../../constants';

const SOURCE_LABELS = {
  quiz: 'Diagnostic quiz',
  infinite: 'Infinite practice',
  hand: 'Live hand',
};

// Each observation is a dot on the posterior line, colored by whether the
// decision behind it was correct — so a dip in the line is visually tied to
// the incorrect answers that caused it.
const ObservationDot = ({ cx, cy, payload }) => {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={payload.correct ? CHART.good : CHART.bad}
      stroke="#0f172a"
      strokeWidth={1.5}
    />
  );
};

const TimelineTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-slate-100">
        Mastery {(p.posterior * 100).toFixed(1)}%
      </div>
      <div className={p.correct ? 'text-emerald-400' : 'text-rose-400'}>
        {p.correct ? 'Correct decision' : 'Incorrect decision'}
      </div>
      <div className="text-slate-400">{SOURCE_LABELS[p.source] || p.source}</div>
    </div>
  );
};

// Posterior-mastery timeline for one skill: the BKT estimate after every
// observation (quiz, drill, or live hand), with the mastery threshold and the
// remediation floor drawn as reference lines.
const SkillTimelineChart = ({ observations }) => {
  const data = observations.map((obs, i) => ({
    n: i + 1,
    posterior: obs.posterior_after,
    correct: obs.correct,
    source: obs.source,
  }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-slate-500 italic">
        No observations yet — take a quiz or play a hand.
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="n"
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
          <Tooltip content={<TimelineTooltip />} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
          <ReferenceLine
            y={MASTERY_THRESHOLD}
            stroke={CHART.good}
            strokeDasharray="4 4"
            label={{ value: 'Mastery', position: 'insideTopRight', fill: CHART.good, fontSize: 10 }}
          />
          <ReferenceLine
            y={REMEDIATION_THRESHOLD}
            stroke={CHART.warn}
            strokeDasharray="4 4"
            label={{ value: 'Remediation', position: 'insideBottomRight', fill: CHART.warn, fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="posterior"
            stroke={CHART.primary}
            strokeWidth={2}
            dot={<ObservationDot />}
            activeDot={{ r: 5, fill: CHART.primary, stroke: '#0f172a', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Memoized: the parent (Analytics) passes each skill's observation array, which
// is stable across unrelated state changes, so the chart (and its per-point
// data build) only re-renders when its own observations actually change.
export default React.memo(SkillTimelineChart);
