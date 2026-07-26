import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import { adminService } from '../../services/api';
import { SKILL_LABELS } from '../../constants';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  LoadingState, ErrorBanner, EmptyState, MasteryBar, pct, relativeTime,
} from '../../components/admin/primitives';

const SKILLS = Object.keys(SKILL_LABELS);

const COLUMNS = [
  { key: 'username', label: 'Student', align: 'left' },
  { key: 'last_activity', label: 'Last active', align: 'right' },
  { key: 'observations', label: 'Answers', align: 'right' },
  { key: 'accuracy', label: 'Accuracy', align: 'right' },
  { key: 'mastery', label: 'Mean mastery', align: 'right' },
  { key: 'mastered', label: 'Mastered', align: 'right' },
  { key: 'hands', label: 'Hands', align: 'right' },
  { key: 'bb_per_100', label: 'bb/100', align: 'right' },
];

const AdminUsers = ({ user, onLogout }) => {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('last_activity');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUsers({
        q: query, sort, order, page, page_size: pageSize,
      });
      setRows(data.results);
      setCount(data.count);
      setError('');
    } catch {
      setError('Failed to load the student roster.');
    } finally {
      setLoading(false);
    }
  }, [query, sort, order, page]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const toggleSort = (key) => {
    if (key === sort) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setOrder('desc');
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Student Roster
          </h2>
          <p className="text-slate-400 mt-1 text-sm max-w-3xl leading-relaxed">
            {count} account{count === 1 ? '' : 's'}. &ldquo;Last active&rdquo; is the last
            graded answer or hand played — not the last login, so a student who logged
            in and bounced doesn&rsquo;t read as active.
          </p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search username or email"
            className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 w-72"
          />
        </div>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <LoadingState message="Loading roster…" />
        ) : rows.length === 0 ? (
          <EmptyState>No students match that search.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-900/80">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`font-semibold py-3 px-4 cursor-pointer select-none hover:text-slate-300 transition text-${col.align}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sort === col.key && (
                          order === 'desc'
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronUp className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="font-semibold py-3 px-4 text-left">Skills</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <Link
                        to={`/admin/users/${row.id}`}
                        className="font-semibold text-slate-100 hover:text-amber-300 transition"
                      >
                        {row.username}
                      </Link>
                      {row.is_staff && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          staff
                        </span>
                      )}
                      <div className="text-[11px] text-slate-500">{row.email || 'no email'}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 text-xs whitespace-nowrap">
                      {relativeTime(row.last_activity)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      {row.observations}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      {row.observations ? pct(row.accuracy, 1) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      {pct(row.mean_mastery)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className={row.skills_mastered > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                        {row.skills_mastered}/{SKILLS.length}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      {row.hands_played}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {row.hands_played ? (
                        <span className={row.bb_per_100 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {row.bb_per_100 > 0 ? '+' : ''}{row.bb_per_100.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    {/* Six-bar mastery sparkline: the shape of a student's
                        profile at a glance, without leaving the roster. */}
                    <td className="py-3 px-4">
                      <div className="flex items-end gap-1 w-32">
                        {SKILLS.map((skill) => (
                          <div key={skill} className="flex-1" title={`${SKILL_LABELS[skill]}: ${pct(row.skills[skill])}`}>
                            <MasteryBar
                              value={row.skills[skill]}
                              mastered={row.skills[skill] >= 0.95 && row.skill_observations[skill] >= 5}
                            />
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/admin/users/${row.id}`}
                        className="text-slate-500 hover:text-amber-300 transition inline-flex"
                        title="Open drill-down"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl transition disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl transition disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
