import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';
import api, { authService } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
