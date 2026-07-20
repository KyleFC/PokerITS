import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, XCircle, RefreshCw, BarChart2, Infinity as InfinityIcon, ArrowRight, Swords, Grid3x3, LineChart, GraduationCap } from 'lucide-react';
import { studentService } from '../services/api';
import { SKILL_LABELS, BKT_PARAMS_BY_SKILL, isMastered } from '../constants';
import PageLayout from '../components/PageLayout';
import SkillCard from '../components/SkillCard';

// The primary navigation targets, rendered as a compact grid. One accent color
// (indigo) is used throughout; the per-card icon is the only visual differentiator.
const NAV_CARDS = [
  {
    to: '/learn',
    icon: GraduationCap,
    title: 'Learning Center',
    blurb: 'Eight interactive lessons covering every skill the tutor grades — pot odds, equity, MDF, ranges and more.',
  },
  {
    to: '/practice',
    icon: InfinityIcon,
    title: 'Infinite Practice',
    blurb: 'Endless procedurally generated drills that adapt to your weakest skills. Every answer feeds your BKT mastery.',
  },
  {
    to: '/arena',
    icon: Swords,
    title: 'Heads Up Arena',
    blurb: 'Play real heads-up hands against exploitable bot profiles. Every decision is graded on EV — win or lose.',
  },
  {
    to: '/analytics',
    icon: LineChart,
    title: 'Learning Analytics',
    blurb: 'Mastery timelines for every skill, remediation flags, and a review list of your Arena hands.',
  },
  {
    to: '/ranges',
    icon: Grid3x3,
    title: 'Range Charts',
    blurb: 'Visual reference for every preflop chart the tutor grades against — 6-max opening ranges and heads-up play.',
  },
];

const Dashboard = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBKTDetails, setShowBKTDetails] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setProfile(await studentService.getProfile());
    } catch (err) {
      setError('Failed to fetch dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <PageLayout onLogout={onLogout} user={user}>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 font-medium">Analyzing student model...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2 mb-6">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Welcome */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Welcome back, {user?.username}</h2>
          <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl leading-relaxed">
            Poker ITS tracks your performance across core theoretical metrics. Pick up where you left off below.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-400" />
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block">Mastered</span>
              <span className="text-lg font-bold text-slate-200">
                {profile
                  ? Object.entries(profile.skills).filter(
                      ([s, v]) => isMastered(v, profile.skill_observations?.[s])
                    ).length
                  : 0}
                /{profile ? Object.keys(profile.skills).length : 0}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BKT Skill Progress Grid */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-xl font-bold text-slate-100">BKT Skill Mastery Profiles</h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Show Details
            </label>
            <button
              onClick={() => setShowBKTDetails(!showBKTDetails)}
              className={`relative inline-flex h-6 w-11 rounded-full transition ${
                showBKTDetails ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  showBKTDetails ? 'translate-x-6' : 'translate-x-0.5'
                }`}
                style={{ marginTop: '2px' }}
              />
            </button>
          </div>
        </div>
        <div className={`grid gap-6 ${showBKTDetails ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'}`}>
          {profile && Object.entries(profile.skills).map(([skillName, value]) => (
            <SkillCard
              key={skillName}
              label={SKILL_LABELS[skillName] || skillName}
              value={value}
              observationCount={profile.skill_observations?.[skillName]}
              params={BKT_PARAMS_BY_SKILL[skillName]}
              showDetails={showBKTDetails}
            />
          ))}
        </div>
      </section>

      {/* Primary navigation */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAV_CARDS.map(({ to, icon: Icon, title, blurb }) => (
          <Link
            key={to}
            to={to}
            className="group block bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 transition"
          >
            <div className="flex items-start gap-3">
              <div className="bg-slate-800 border border-slate-700 p-2.5 rounded-lg shrink-0">
                <Icon className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition">{title}</h3>
                  <ArrowRight className="h-4 w-4 text-slate-500 shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-indigo-400" />
                </div>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{blurb}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

    </PageLayout>
  );
};

export default Dashboard;
