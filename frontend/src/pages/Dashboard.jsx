import React, { useState, useEffect } from 'react';
import { Trophy, XCircle, RefreshCw, BarChart2, BookOpen } from 'lucide-react';
import { studentService, pokerService } from '../services/api';
import { SKILL_LABELS, MASTERY_THRESHOLD } from '../constants';
import PageLayout from '../components/PageLayout';
import SkillCard from '../components/SkillCard';
import ScenarioCard from '../components/ScenarioCard';
import QuizModal from '../components/QuizModal';

const Dashboard = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeScenario, setActiveScenario] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [profileData, scenariosData] = await Promise.all([
        studentService.getProfile(),
        pokerService.getScenarios(),
      ]);
      setProfile(profileData);
      setScenarios(scenariosData);
    } catch (err) {
      setError('Failed to fetch dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuizCompleted = () => {
    setActiveScenario(null);
    setLoading(true);
    fetchDashboardData();
  };

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
      <section className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Welcome back, {user?.username}!</h2>
          <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl leading-relaxed">
            Poker ITS tracks your performance across core theoretical metrics. Practice with the diagnostic quiz bank below.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center gap-3 shadow-inner">
            <Trophy className="h-8 w-8 text-amber-400" />
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-bold block">Mastered</span>
              <span className="text-lg font-bold text-slate-200">
                {profile ? Object.values(profile.skills).filter((v) => v >= MASTERY_THRESHOLD).length : 0}/5
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BKT Skill Progress Grid */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="h-5 w-5 text-indigo-400" />
          <h3 className="text-xl font-bold text-slate-100">BKT Skill Mastery Profiles</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {profile && Object.entries(profile.skills).map(([skillName, value]) => (
            <SkillCard
              key={skillName}
              label={SKILL_LABELS[skillName] || skillName}
              value={value}
            />
          ))}
        </div>
      </section>

      {/* Scenario Diagnostic Bank */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          <h3 className="text-xl font-bold text-slate-100">Diagnostic Quiz Bank</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onStart={setActiveScenario}
            />
          ))}
        </div>
      </section>

      {/* Quiz Modal Overlay */}
      {activeScenario && (
        <QuizModal
          scenario={activeScenario}
          onClose={() => setActiveScenario(null)}
          onCompleted={handleQuizCompleted}
        />
      )}
    </PageLayout>
  );
};

export default Dashboard;
