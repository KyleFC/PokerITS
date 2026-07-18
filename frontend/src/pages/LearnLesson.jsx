import React, { Suspense, useEffect } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import LessonLayout from '../components/learn/LessonLayout';
import { LESSON_BY_SLUG } from '../lessons/meta';
import { LESSON_COMPONENTS } from '../lessons/registry';

// One route renders every lesson: the slug resolves against the curriculum
// metadata and the lazy component registry. Unknown slugs bounce back to the
// hub instead of 404ing — old deep links degrade gracefully.
const LearnLesson = ({ user, onLogout }) => {
  const { slug } = useParams();
  const location = useLocation();
  const lesson = LESSON_BY_SLUG[slug];
  const Body = LESSON_COMPONENTS[slug];

  // Honor /learn/<slug>#<section-id> deep links (quiz feedback and the future
  // LLM tutor link straight to sections). Re-run when the hash changes while
  // already on the page. The body is lazy-loaded, so retry briefly until the
  // anchor target exists.
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const id = location.hash.slice(1);
    let attempts = 0;
    let timer;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        // Instant, not smooth: smooth scrolling animates via rAF, which
        // browsers throttle to zero in hidden/background tabs — the scroll
        // silently never happens. Instant scrolling works unconditionally.
        el.scrollIntoView();
      } else if (attempts < 50) {
        // A cold load can spend a while on the auth check + lazy chunk before
        // the anchor exists; keep retrying for ~5s.
        attempts += 1;
        timer = setTimeout(tryScroll, 100);
      }
    };
    tryScroll();
    return () => clearTimeout(timer);
  }, [slug, location.hash]);

  if (!lesson || !Body) {
    return <Navigate to="/learn" replace />;
  }

  return (
    <PageLayout onLogout={onLogout} user={user}>
      <LessonLayout lesson={lesson}>
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Loading lesson...</p>
            </div>
          }
        >
          <Body />
        </Suspense>
      </LessonLayout>
    </PageLayout>
  );
};

export default LearnLesson;
