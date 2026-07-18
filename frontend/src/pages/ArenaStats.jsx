import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, RefreshCw, XCircle, Swords, ArrowLeft, TrendingDown, Dices,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import { pokerService } from '../services/api';
import { CHART } from '../constants';
import PageLayout from '../components/PageLayout';

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'];

const PROFILE_LABELS = {
  balanced: 'Balanced',
  nit: 'The Nit',
  station: 'Calling Station',
  maniac: 'The Maniac',
};

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 10 },
  tickLine: false,
};

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400">Hand #{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="font-bold text-slate-100">{formatter(p)}</div>
      ))}
    </div>
  );
};

const StatTile = ({ label, value, sub, accent = 'text-slate-100' }) => (
  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-2xl font-extrabold mt-1 ${accent}`}>{value}</div>
    {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

const winRate = (bucket) =>
  bucket.hands ? `${Math.round((bucket.wins / bucket.hands) * 100)}%` : '—';

// Session stats for the Heads Up Arena. Deliberate framing (project.md §1):
// decision quality (EV loss) is the headline; BB results are shown, but
// second, smaller, and explicitly labeled as variance-laden — the ITS teaches
// decisions, and this page must not retrain students to chase outcomes.
const ArenaStats = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    pokerService.getHandStats()
      .then(setStats)
      .catch(() => setError('Failed to load your Arena stats. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageLayout onLogout={onLogout} user={user}>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
          <p className="text-slate-400 font-medium">Crunching your session history...</p>
        </div>
      </PageLayout>
    );
  }

  const empty = !stats || stats.hands_played === 0;
  const streetData = empty ? [] : STREET_ORDER
    .map((s) => ({ street: s, loss: stats.ev_loss_by_street[s] || 0 }))
    .filter((d) => d.loss > 0 || STREET_ORDER.indexOf(d.street) === 0);
  const profiles = empty ? [] : Object.entries(stats.by_profile)
    .sort((a, b) => b[1].hands - a[1].hands);

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg">
            <BarChart3 className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Arena Session Stats</h2>
            <p className="text-slate-400 mt-1 text-sm max-w-xl leading-relaxed">
              Your decision quality comes first — results follow, but only the
              EV trend is a signal. Chips won and lost are mostly variance.
            </p>
          </div>
        </div>
        <Link
          to="/arena"
          className="flex items-center gap-2 self-start md:self-center text-sm font-semibold text-slate-300 border border-slate-700 hover:border-indigo-500/50 hover:text-indigo-300 px-4 py-2.5 rounded-lg transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the Arena
        </Link>
      </section>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2 mb-6">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {empty && !error && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 shadow-2xl flex flex-col items-center gap-4 text-center">
          <Swords className="h-10 w-10 text-slate-600" />
          <p className="text-slate-300 font-semibold">No completed hands yet.</p>
          <p className="text-sm text-slate-500 max-w-md">
            Play some hands in the Heads Up Arena and your session stats —
            decision quality first — will build up here.
          </p>
          <Link
            to="/arena"
            className="mt-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-6 py-2.5 rounded-xl transition flex items-center gap-2"
          >
            <Swords className="h-4 w-4" /> Go play
          </Link>
        </div>
      )}

      {!empty && (
        <>
          {/* Stat tiles: decision quality leads, results trail with a variance label */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatTile
              label="Avg EV lost per hand"
              value={`${stats.ev_loss_per_hand_bb.toFixed(2)} BB`}
              sub="Decision quality — lower is better"
              accent="text-indigo-300"
            />
            <StatTile
              label="Preflop discipline"
              value={
                stats.preflop.graded_hands
                  ? `${Math.round((1 - stats.preflop.deviation_rate) * 100)}%`
                  : '—'
              }
              sub={`On-chart opens over ${stats.preflop.graded_hands} graded hands`}
              accent="text-indigo-300"
            />
            <StatTile
              label="Hands played"
              value={stats.hands_played}
              sub={`${stats.record.win}W · ${stats.record.loss}L · ${stats.record.tie}T`}
            />
            <StatTile
              label="Results (variance)"
              value={`${stats.net_bb_total > 0 ? '+' : ''}${stats.net_bb_total} BB`}
              sub={`${stats.bb_per_100 > 0 ? '+' : ''}${stats.bb_per_100} BB/100 — noisy at this sample size`}
              accent={stats.net_bb_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
          </section>

          {/* Headline chart: cumulative EV loss (the number the ITS teaches to) */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl mb-8">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-100">Decision quality — cumulative EV given up</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Every graded mistake adds to this line. A flat line means you're
              playing close to the math, no matter what the results below say.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timeline} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="hand" {...axisProps} axisLine={{ stroke: CHART.grid }} allowDecimals={false} />
                  <YAxis {...axisProps} axisLine={false} unit=" BB" />
                  <Tooltip content={(
                    <ChartTooltip formatter={(p) => `${p.value} BB EV given up so far`} />
                  )} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
                  <Line
                    type="monotone"
                    dataKey="cumulative_ev_loss_bb"
                    stroke={CHART.primary}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: CHART.primary, stroke: '#0f172a', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Secondary: results, explicitly framed as variance */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Dices className="h-5 w-5 text-sky-500" />
              <h3 className="text-base font-bold text-slate-300">Results — cumulative BB won/lost</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              This line swings on card luck. A downswing here with a flat EV
              line above means you ran bad, not that you played bad.
            </p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timeline} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="hand" {...axisProps} axisLine={{ stroke: CHART.grid }} allowDecimals={false} />
                  <YAxis {...axisProps} axisLine={false} unit=" BB" />
                  <Tooltip content={(
                    <ChartTooltip formatter={(p) => `${p.value > 0 ? '+' : ''}${p.value} BB net`} />
                  )} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
                  <ReferenceLine y={0} stroke={CHART.axis} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="cumulative_bb"
                    stroke={CHART.results}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: CHART.results, stroke: '#0f172a', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* EV loss by street */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-slate-100 mb-1">Where the EV leaks</h3>
              <p className="text-xs text-slate-500 mb-4">Total EV given up per street — your study priority list.</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={streetData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="street" {...axisProps} axisLine={{ stroke: CHART.grid }} />
                    <YAxis {...axisProps} axisLine={false} unit=" BB" />
                    <Tooltip
                      cursor={{ fill: 'rgba(100,116,139,0.08)' }}
                      content={({ active, payload }) => (active && payload?.length ? (
                        <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                          <div className="text-slate-400 capitalize">{payload[0].payload.street}</div>
                          <div className="font-bold text-slate-100">{payload[0].value.toFixed(2)} BB given up</div>
                        </div>
                      ) : null)}
                    />
                    <Bar dataKey="loss" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                      {streetData.map((d) => <Cell key={d.street} fill={CHART.warn} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Showdown split + per-profile table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
              <div>
                <h3 className="text-base font-bold text-slate-100 mb-3">Win rate by hand ending</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">At showdown</div>
                    <div className="text-xl font-extrabold text-slate-100 mt-0.5">{winRate(stats.showdown)}</div>
                    <div className="text-[11px] text-slate-500">{stats.showdown.wins} of {stats.showdown.hands} hands</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Without showdown</div>
                    <div className="text-xl font-extrabold text-slate-100 mt-0.5">{winRate(stats.non_showdown)}</div>
                    <div className="text-[11px] text-slate-500">{stats.non_showdown.wins} of {stats.non_showdown.hands} hands</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 mb-1">By opponent</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Exploit the leaky profiles first — you should beat The Nit and
                  the Calling Station before the Balanced bot.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="pb-1.5 font-bold">Opponent</th>
                      <th className="pb-1.5 font-bold text-right">Hands</th>
                      <th className="pb-1.5 font-bold text-right">EV lost/hand</th>
                      <th className="pb-1.5 font-bold text-right">Net BB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(([key, p]) => (
                      <tr key={key} className="border-t border-slate-800">
                        <td className="py-2 font-semibold text-slate-200">{PROFILE_LABELS[key] || key}</td>
                        <td className="py-2 text-right text-slate-300 tabular-nums">{p.hands}</td>
                        <td className="py-2 text-right text-indigo-300 tabular-nums">
                          {(p.ev_loss_bb / p.hands).toFixed(2)}
                        </td>
                        <td className={`py-2 text-right font-bold tabular-nums ${
                          p.net_bb > 0 ? 'text-emerald-400' : p.net_bb < 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {p.net_bb > 0 ? '+' : ''}{p.net_bb}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </PageLayout>
  );
};

export default ArenaStats;
