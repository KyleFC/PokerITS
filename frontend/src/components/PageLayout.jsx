import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, BrainCircuit } from 'lucide-react';

// App shell: sticky header with branding + user chip, main content slot, footer.
const PageLayout = ({ children, onLogout, user }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Poker ITS</span>
              <span className="text-xs block text-slate-400 font-medium">Intelligent Tutoring System</span>
            </div>
          </div>

          <nav className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-300 hover:text-white transition">Dashboard</Link>
            <Link to="/practice" className="text-sm font-medium text-slate-300 hover:text-white transition">Infinite Practice</Link>
            <Link to="/tutorial" className="text-sm font-medium text-slate-300 hover:text-white transition">Tutorial</Link>
            {user && (
              <div className="flex items-center gap-4 border-l border-slate-800 pl-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold text-sm">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-300">{user.username}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 transition"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
