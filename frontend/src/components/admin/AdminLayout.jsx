import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Students' },
  { to: '/admin/items', label: 'Item Analysis' },
  { to: '/admin/curves', label: 'Learning Curves' },
  { to: '/admin/health', label: 'System Health' },
];

// Admin shell. Deliberately its own layout rather than PageLayout: the student
// nav (Practice / Arena / Exploit Lab) is noise here, and the amber chrome makes
// it unmistakable at a glance that you are looking at cohort data rather than
// your own.
const AdminLayout = ({ children, user, onLogout }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
    <header className="border-b border-amber-500/20 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 p-2 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-100">Instructor Console</span>
            <span className="text-xs block text-amber-500/80 font-medium">
              Poker ITS &middot; cohort analytics
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          <div className="flex items-center gap-3 border-l border-slate-800 pl-4 ml-3">
            <Link
              to="/"
              className="text-sm font-medium text-slate-400 hover:text-white transition flex items-center gap-1"
              title="Back to the student app"
            >
              <ArrowLeft className="h-4 w-4" />
              Student view
            </Link>
            {user && (
              <>
                <span className="text-sm font-medium text-slate-300">{user.username}</span>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>

    <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </main>
  </div>
);

export default AdminLayout;
