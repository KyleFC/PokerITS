import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import api, { authService } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tutorial from './pages/Tutorial';
import InfinitePractice from './pages/InfinitePractice';
import HeadsUpArena from './pages/HeadsUpArena';
import ExploitLab from './pages/ExploitLab';
import ArenaStats from './pages/ArenaStats';
import Analytics from './pages/Analytics';
import RangeCharts from './pages/RangeCharts';
import LearnHub from './pages/LearnHub';
import LearnLesson from './pages/LearnLesson';

export default function App() {
  const [auth, setAuth] = useState(authService.isAuthenticated());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (auth) {
        try {
          const response = await api.get('/auth/me/');
          setUser(response.data);
        } catch (err) {
          setAuth(false);
          authService.logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [auth]);

  const handleLogout = () => {
    authService.logout();
    setAuth(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <BrainCircuit className="h-10 w-10 text-indigo-500 animate-spin" />
        <span className="text-sm font-semibold tracking-wider text-slate-400">Loading Poker ITS...</span>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!auth ? <Login setAuth={setAuth} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/register"
          element={!auth ? <Register /> : <Navigate to="/" replace />}
        />
        <Route
          path="/"
          element={auth ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tutorial"
          element={auth ? <Tutorial user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/practice"
          element={auth ? <InfinitePractice user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/arena"
          element={auth ? <HeadsUpArena user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/arena/stats"
          element={auth ? <ArenaStats user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/exploit"
          element={auth ? <ExploitLab user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        {/* Live Play became the Heads Up Arena; keep old links working. */}
        <Route path="/play" element={<Navigate to="/arena" replace />} />
        <Route
          path="/analytics"
          element={auth ? <Analytics user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/ranges"
          element={auth ? <RangeCharts user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/learn"
          element={auth ? <LearnHub user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/learn/:slug"
          element={auth ? <LearnLesson user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
