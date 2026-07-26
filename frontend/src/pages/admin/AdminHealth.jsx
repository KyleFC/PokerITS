import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { adminService } from '../../services/api';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Panel, StatCard, LoadingState, ErrorBanner, relativeTime,
} from '../../components/admin/primitives';

const PHASE_LABELS = {
  scout: 'Scout (observing the opponent)',
  diagnosis: 'Diagnosis (committing to a read)',
  exploit: 'Exploit (demonstrating the adjustment)',
};

const ROW_LABELS = {
  users: 'Users',
  observations: 'Skill observations',
  hand_histories: 'Hand histories',
  live_hands: 'Live hands',
  exploit_matches: 'Exploit matches',
};

const AdminHealth = ({ user, onLogout }) => {
  const [data, setData] = useState(null);
  const [staleHours, setStaleHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    adminService
      .getHealth(staleHours)
      .then(setData)
      .catch(() => setError('Failed to load system health.'))
      .finally(() => setLoading(false));
  }, [staleHours]);

  if (loading && !data) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <LoadingState message="Checking system health…" />
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

  const { live_hands: liveHands, matches, row_counts: rowCounts, integrity } = data;
  const abandoned = Object.entries(matches.abandoned_by_phase || {});
  const integrityIssues = Object.values(integrity).reduce((a, b) => a + b, 0);

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            System Health
          </h2>
          <p className="text-slate-400 mt-1 text-sm max-w-4xl leading-relaxed">
            Abandoned sessions are a UX signal, not just housekeeping: a pile of hands
            left unfinished, or matches dropped at the same phase, marks the exact
            point where students give up.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Consider stale after
          <select
            value={staleHours}
            onChange={(e) => setStaleHours(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Open live hands"
          value={liveHands.open}
          hint="in progress right now or abandoned"
        />
        <StatCard
          label="Stale live hands"
          value={liveHands.stale}
          tone={liveHands.stale ? 'warn' : 'good'}
          hint={liveHands.oldest ? `oldest ${relativeTime(liveHands.oldest)}` : 'none'}
        />
        <StatCard
          label="Incomplete matches"
          value={matches.incomplete}
          hint={`${matches.stale} stale`}
          tone={matches.stale ? 'warn' : 'default'}
        />
        <StatCard
          label="Integrity issues"
          value={integrityIssues}
          tone={integrityIssues ? 'warn' : 'good'}
          hint={integrityIssues ? 'see below' : 'nothing flagged'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel
          title="Where students abandon Exploit Lab"
          subtitle={`Matches left incomplete for more than ${data.stale_hours}h, grouped by the phase they stalled in.`}
        >
          {abandoned.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              No stale matches.
            </div>
          ) : (
            <div className="space-y-3">
              {abandoned.map(([phase, n]) => (
                <div key={phase}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-300">{PHASE_LABELS[phase] || phase}</span>
                    <span className="text-slate-400 tabular-nums text-xs">{n}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(n / Math.max(1, matches.stale)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">
                Heavy drop-off in the diagnosis phase means students reach the
                checkpoint but can&rsquo;t commit to a read — a hint the scout phase
                isn&rsquo;t giving them enough to go on.
              </p>
            </div>
          )}
        </Panel>

        <Panel
          title="Data integrity"
          subtitle="Rows that will still work but can't be fully analysed later."
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-slate-300">Answers with no question id</div>
                <div className="text-[11px] text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                  These moved a mastery estimate but can never be traced back to what
                  was asked, so they are invisible to item analysis.
                </div>
              </div>
              <span
                className={`text-lg font-bold tabular-nums shrink-0 ${
                  integrity.observations_without_reference ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {integrity.observations_without_reference}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-slate-800 pt-3">
              <div>
                <div className="text-sm text-slate-300">Hands with no net result</div>
                <div className="text-[11px] text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                  Recorded before <code>net_bb</code> existed. They count toward
                  decision quality but contribute nothing to bb/100.
                </div>
              </div>
              <span
                className={`text-lg font-bold tabular-nums shrink-0 ${
                  integrity.hands_without_net_bb ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {integrity.hands_without_net_bb}
              </span>
            </div>
          </div>
          {integrityIssues > 0 && (
            <div className="flex items-start gap-2 mt-4 pt-4 border-t border-slate-800 text-[11px] text-amber-400/80 leading-relaxed">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Neither is a bug to fix retroactively — they are historical rows. Worth
              knowing before you quote a number that depends on them.
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Table sizes"
        subtitle="Row counts across the student model and game log."
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(rowCounts).map(([table, n]) => (
            <div key={table} className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Database className="h-3 w-3" />
                {ROW_LABELS[table] || table}
              </div>
              <div className="text-xl font-bold text-slate-100 tabular-nums mt-1">
                {n.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          Live hands are prunable once complete — their results are copied into hand
          histories, so nothing analytics needs is lost.
        </div>
      </Panel>
    </AdminLayout>
  );
};

export default AdminHealth;
