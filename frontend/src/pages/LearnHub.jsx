import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, ArrowRight, Target } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { studentService } from '../services/api';
import { LESSONS } from '../lessons/meta';
import { SKILL_LABELS, isMastered } from '../constants';

// The Learning Center hub: the ordered curriculum. Skill lessons show the
// student's live BKT mastery next to their card (fetched once, degrades
// silently offline — the hub is fully usable without the backend).
const LearnHub = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const skills = profile?.skills;

  useEffect(() => {
    studentService.getProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Hero */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex items-center gap-4">
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Learning Center</h2>
          <p className="text-slate-400 mt-1 text-sm max-w-2xl leading-relaxed">
            Eight lessons covering every concept this tutor grades. The core idea behind
            all of them: a decision is judged by its math at the moment you make it —
            never by the card that falls next.
          </p>
        </div>
      </section>

      {/* Fundamentals prerequisite */}
      <section className="mb-8">
        <Link
          to="/tutorial"
          className="group block bg-slate-900 border border-slate-700 hover:border-indigo-500/50 rounded-xl p-5 transition"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-800 rounded-xl">
                <BookOpen className="h-6 w-6 text-slate-300" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Start here if you're new</p>
                <h3 className="font-bold text-slate-100 group-hover:text-indigo-300 transition">
                  Fundamentals: Poker Rules
                </h3>
                <p className="text-slate-400 text-sm mt-0.5">
                  Hand rankings, betting rounds, and position basics — the vocabulary the lessons below assume.
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-500 shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-indigo-400" />
          </div>
        </Link>
      </section>

      {/* Curriculum */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          The curriculum — in order
        </h3>
        {LESSONS.map((lesson, i) => {
          const Icon = lesson.icon;
          const mastery = lesson.skill && skills ? skills[lesson.skill] : null;
          return (
            <div
              key={lesson.slug}
              className="bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 transition group"
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold text-sm">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      to={`/learn/${lesson.slug}`}
                      className="font-bold text-slate-100 group-hover:text-indigo-300 transition flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4 text-indigo-400 shrink-0" />
                      {lesson.title}
                    </Link>
                    {lesson.skill && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2 py-0.5 rounded-md">
                        {SKILL_LABELS[lesson.skill]}
                      </span>
                    )}
                    {mastery != null && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isMastered(mastery, profile?.skill_observations?.[lesson.skill])
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-slate-300 bg-slate-800/80 border-slate-700'
                        }`}
                      >
                        Mastery {Math.round(mastery * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{lesson.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Link
                    to={`/learn/${lesson.slug}`}
                    className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                  >
                    Read <ArrowRight className="h-4 w-4" />
                  </Link>
                  {lesson.skill && (
                    <Link
                      to={`/practice?skill=${lesson.skill}`}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                    >
                      <Target className="h-3 w-3" /> Drill
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </PageLayout>
  );
};

export default LearnHub;
