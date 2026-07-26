import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { adminService } from '../../services/api';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Panel, StatCard, LoadingState, ErrorBanner, EmptyState, Pill, pct,
} from '../../components/admin/primitives';

const FLAG_META = {
  possible_miskey: { tone: 'bad', label: 'possible miskey' },
  too_easy: { tone: 'warn', label: 'too easy' },
  too_hard: { tone: 'warn', label: 'too hard' },
  low_discrimination: { tone: 'warn', label: 'weak discrimination' },
  insufficient_data: { tone: 'slate', label: 'low volume' },
};

const AdminItems = ({ user, onLogout }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  useEffect(() => {
    adminService
      .getItems(1)
      .then(setData)
      .catch(() => setError('Failed to load item analysis.'))
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    const all = data?.items || [];
    if (!onlyFlagged) return all;
    return all.filter(
      (i) => i.flags.length && !(i.flags.length === 1 && i.flags[0] === 'insufficient_data')
    );
  }, [data, onlyFlagged]);

  if (loading) {
    return (
      <AdminLayout user={user} onLogout={onLogout}>
        <LoadingState message="Analysing the question bank…" />
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

  const { thresholds, unattempted } = data;
  const miskeys = (data.items || []).filter((i) => i.flags.includes('possible_miskey'));
  const analysable = (data.items || []).filter((i) => i.attempts >= thresholds.min_attempts);

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Item Analysis
        </h2>
        <p className="text-slate-400 mt-1 text-sm max-w-4xl leading-relaxed">
          <strong className="text-slate-300">p-value</strong> is the share of attempts
          answered correctly — near 1.0 the question teaches nothing, near the guess
          rate it is too hard or badly worded.{' '}
          <strong className="text-slate-300">Discrimination</strong> is how strongly
          getting this item right predicts doing well on everything else. Positive is
          healthy; <strong className="text-rose-400">negative means the answer key is
          probably wrong</strong> — the students who understand the material are being
          marked incorrect.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Items answered" value={(data.items || []).length} />
        <StatCard
          label={`With ≥ ${thresholds.min_attempts} attempts`}
          value={analysable.length}
          hint="enough data to judge"
        />
        <StatCard
          label="Miskey suspects"
          value={miskeys.length}
          tone={miskeys.length ? 'bad' : 'good'}
          hint={miskeys.length ? 'check these answer keys' : 'none detected'}
        />
        <StatCard
          label="Never attempted"
          value={unattempted.length}
          tone={unattempted.length ? 'warn' : 'good'}
          hint="authored bank coverage gap"
        />
      </div>

      {miskeys.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-300 text-sm">
                {miskeys.length} item{miskeys.length === 1 ? '' : 's'} may have the wrong answer key
              </h3>
              <p className="text-xs text-rose-200/70 mt-1 leading-relaxed">
                Strong students are getting {miskeys.length === 1 ? 'this one' : 'these'} wrong
                while weak students get {miskeys.length === 1 ? 'it' : 'them'} right. Re-read the
                scenario and its <code className="text-rose-200">correct_answer</code> in
                the bank before trusting any mastery estimate that depends on{' '}
                {miskeys.length === 1 ? 'it' : 'them'}.
              </p>
              <ul className="mt-2 space-y-1">
                {miskeys.map((i) => (
                  <li key={i.item_id} className="text-xs text-rose-200 font-mono">
                    {i.item_id}
                    {i.correct_answer && (
                      <span className="text-rose-200/60 font-sans">
                        {' '}— keyed as &ldquo;{i.correct_answer}&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <Panel
        title="Per-item statistics"
        subtitle={`Discrimination needs at least ${thresholds.min_students} distinct students before it means anything; low-volume rows are flagged rather than judged.`}
        action={
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlyFlagged}
              onChange={(e) => setOnlyFlagged(e.target.checked)}
              className="accent-amber-500 cursor-pointer"
            />
            Flagged only
          </label>
        }
        className="mb-6"
      >
        {items.length === 0 ? (
          <EmptyState>
            {onlyFlagged
              ? 'No flagged items — the bank looks healthy.'
              : 'No graded quiz answers recorded yet.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="text-left font-semibold py-2">Item</th>
                  <th className="text-left font-semibold py-2">Skill</th>
                  <th className="text-right font-semibold py-2">Attempts</th>
                  <th className="text-right font-semibold py-2">Students</th>
                  <th className="text-right font-semibold py-2">p-value</th>
                  <th className="text-right font-semibold py-2">Discrim.</th>
                  <th className="text-left font-semibold py-2 pl-4">Flags</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const lowVolume = item.flags.includes('insufficient_data');
                  return (
                    <tr
                      key={item.item_id}
                      className={`border-b border-slate-800/60 ${lowVolume ? 'opacity-60' : ''}`}
                    >
                      <td className="py-2.5 pr-4 max-w-md">
                        <div className="flex items-center gap-2">
                          {item.generated && (
                            <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" title="Procedurally generated" />
                          )}
                          <span className="font-semibold text-slate-200">{item.title}</span>
                          {item.orphaned && <Pill tone="warn">not in bank</Pill>}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {item.item_id}
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-400 text-xs">{item.skill_label}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-300">
                        {item.attempts}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-400">
                        {item.students}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <span
                          className={
                            item.flags.includes('too_easy') || item.flags.includes('too_hard')
                              ? 'text-amber-400 font-semibold'
                              : 'text-slate-300'
                          }
                        >
                          {pct(item.p_value, 1)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {item.discrimination == null ? (
                          <span className="text-slate-600" title="Needs students with other answers to compare against">
                            —
                          </span>
                        ) : (
                          <span
                            className={
                              item.discrimination < thresholds.miskey_d
                                ? 'text-rose-400 font-bold'
                                : item.discrimination < thresholds.weak_d
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                            }
                          >
                            {item.discrimination > 0 ? '+' : ''}
                            {item.discrimination.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-4">
                        <div className="flex flex-wrap gap-1">
                          {item.flags.map((flag) => {
                            const meta = FLAG_META[flag] || { tone: 'slate', label: flag };
                            return (
                              <Pill key={flag} tone={meta.tone}>{meta.label}</Pill>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Never attempted"
        subtitle="Authored bank items no student has reached. Invisible in the table above — an item with no answers produces no row — but exactly what you need before claiming the bank is exercised."
      >
        {unattempted.length === 0 ? (
          <EmptyState>Every authored scenario has been attempted.</EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unattempted.map((item) => (
              <div
                key={item.item_id}
                className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2"
              >
                <div className="text-sm text-slate-200">{item.title}</div>
                <div className="text-[11px] text-slate-500">{item.skill_label}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AdminLayout>
  );
};

export default AdminItems;
