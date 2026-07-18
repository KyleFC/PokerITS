// Lesson body components, lazy-loaded per slug so each lesson is its own
// chunk and importing meta.js stays cheap. meta.test.js asserts every slug in
// LESSONS has an entry here. IMPORTANT: meta.js must never import this file
// (it would drag every lesson body into every page that links to a lesson).
import { lazy } from 'react';

export const LESSON_COMPONENTS = {
  'ev-and-decision-quality': lazy(() => import('./content/EvDecisionQuality.jsx')),
  'preflop-ranges': lazy(() => import('./content/PreflopRanges.jsx')),
  'counting-outs': lazy(() => import('./content/CountingOuts.jsx')),
  'equity-estimation': lazy(() => import('./content/EquityEstimation.jsx')),
  'pot-odds': lazy(() => import('./content/PotOdds.jsx')),
  'implied-odds': lazy(() => import('./content/ImpliedOdds.jsx')),
  'bet-sizing-and-alpha': lazy(() => import('./content/BetSizingAlpha.jsx')),
  'mdf': lazy(() => import('./content/Mdf.jsx')),
};
