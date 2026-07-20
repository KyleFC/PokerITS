import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, GraduationCap, Target } from 'lucide-react';
import { LESSONS, LESSON_BY_SLUG } from '../../lessons/meta';
import { SKILL_LABELS } from '../../constants';

// Shared shell for every /learn/:slug page: sticky section sidebar (anchor
// links from the lesson's meta), header with skill chip, prerequisite chips,
// the lesson body, a "drill this skill" CTA and Prev/Next curriculum
// navigation. Mirrors the Tutorial page's proven grid + card styling.
const LessonLayout = ({ lesson, children }) => {
  const index = LESSONS.findIndex((l) => l.slug === lesson.slug);
  const prev = index > 0 ? LESSONS[index - 1] : null;
  const next = index < LESSONS.length - 1 ? LESSONS[index + 1] : null;
  const Icon = lesson.icon;

  const drillHref = lesson.skill ? `/practice?skill=${lesson.skill}` : '/practice';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Section sidebar */}
      <aside className="lg:col-span-1">
        <div className="sticky top-24 space-y-2">
          <Link
            to="/learn"
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-300 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All lessons
          </Link>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">
            In this lesson
          </h3>
          {lesson.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left text-slate-300 hover:bg-slate-800/50 hover:text-white"
            >
              <span className="text-sm font-medium">{section.title}</span>
            </a>
          ))}
        </div>
      </aside>

      {/* Lesson body */}
      <div className="lg:col-span-3">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 md:p-10">
          {/* Header */}
          <div className="flex items-start gap-3 mb-2 flex-wrap">
            <div className="p-3 bg-indigo-600/20 rounded-lg">
              <Icon className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <h1 className="text-3xl md:text-4xl font-bold text-white">{lesson.title}</h1>
              {lesson.skill && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/15">
                    Graded skill: {SKILL_LABELS[lesson.skill]}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Prerequisites */}
          {lesson.prereqs.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap text-xs">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Before this:</span>
              {lesson.prereqs.map((slug) => {
                const prereq = LESSON_BY_SLUG[slug];
                if (!prereq) return null;
                return (
                  <Link
                    key={slug}
                    to={`/learn/${slug}`}
                    className="font-semibold text-slate-300 bg-slate-800/60 border border-slate-700 px-2.5 py-1 rounded-md hover:border-indigo-500/50 hover:text-indigo-300 transition"
                  >
                    {prereq.shortTitle}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Content */}
          <div className="text-slate-200 leading-relaxed space-y-8 mt-8">{children}</div>

          {/* Drill CTA */}
          <div className="mt-10">
            <Link
              to={drillHref}
              className="group flex items-center justify-between gap-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl p-5 transition"
            >
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-white shrink-0" />
                <div>
                  <p className="font-bold text-white">
                    {lesson.skill ? `Drill ${SKILL_LABELS[lesson.skill]}` : 'Drill it in Infinite Practice'}
                  </p>
                  <p className="text-xs text-indigo-100/80 mt-0.5">
                    Reading is not evidence — graded practice is. Every answer updates your mastery.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Prev / Next */}
          <div className="flex gap-4 mt-10 pt-8 border-t border-slate-700">
            {prev ? (
              <Link
                to={`/learn/${prev.slug}`}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition text-sm font-medium text-slate-200"
              >
                <ChevronLeft className="h-4 w-4" />
                {prev.shortTitle}
              </Link>
            ) : (
              <Link
                to="/tutorial"
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition text-sm font-medium text-slate-200"
              >
                <GraduationCap className="h-4 w-4" />
                Fundamentals
              </Link>
            )}
            <div className="flex-1" />
            {next && (
              <Link
                to={`/learn/${next.slug}`}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition text-sm font-medium text-white"
              >
                {next.shortTitle}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonLayout;
