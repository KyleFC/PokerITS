# Poker ITS — Frontend

Vite 7 + React 18 + Tailwind 4 SPA. Recharts for visualization, Axios for transport,
React Router for routing. No state-management library — pages own their own fetches.

See the [root README](../README.md) for the project overview.

## Setup

```bash
npm install && npm run dev
```

Dev server on `:5173`, proxying `/api` → `localhost:8000`. Start the backend first
(from `backend/` — see [backend/README.md](../backend/README.md)).

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server with the API proxy |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Production build to `dist/` |

## Layout

```
src/
  pages/            one file per route; pages/admin/ is the instructor console
  components/       PokerTable, PokerCard, ActionBar, quiz + replay modals
    learn/          LessonLayout, prose primitives, interactive widgets/
    exploit/        HudPanel, DiagnosisModal, MatchReveal
    analytics/      SkillTimelineChart, HandReviewList
    admin/          AdminLayout and shared console primitives
  lessons/
    meta.js         curriculum metadata — importable without pulling lesson bodies
    registry.jsx    slug → React.lazy body (one Vite chunk per lesson)
    math.js         pure mirror of the backend's grading math (see below)
    content/        the eight lesson bodies
  services/api.js   Axios instance, JWT interceptor, per-domain service objects
  constants.js      skill labels, mastery gates, chart palette, Exploit Lab options
```

## Conventions

- **`constants.js` mirrors the backend, it does not decide.** `BKT_PARAMS_BY_SKILL`,
  `MASTERY_THRESHOLD`, and `MASTERY_MIN_OBSERVATIONS` exist for display; the server is the
  source of truth. Retune the backend and update these together.
- **`lessons/math.js` is the anti-drift keystone.** Every formula and number rendered in a
  lesson or widget flows through it, and `lessons/__tests__/math.test.js` pins its outputs
  to backend-emitted values. A lesson can therefore never quietly contradict the grader
  that marks the student wrong.
- **Mastery display is gated on evidence, not just the posterior.** Use
  `isMastered(mastery, count)` and `attemptsForSkill(profile, skill)` rather than comparing
  the raw number. Until a skill has an observation, its "mastery" is the untouched BKT
  prior — the model's assumption about everyone, not progress the student made — and the UI
  says so explicitly.
- **Charts use the validated `CHART` palette** in `constants.js` (lightness band, chroma,
  CVD separation, ≥3:1 contrast on the slate-900 surface). Don't hand-pick hex values.
- **The admin route guard is a courtesy.** `user.is_staff` decides what renders; the API
  re-checks on every request and 403s regardless.

## Testing notes

- `src/test/setup.js` stubs `ResizeObserver`, which Recharts requires under jsdom. Charts
  still log a zero-width warning in tests — expected, not a failure.
- Prefer asserting on accessible names (`aria-label`, roles) over class names or text
  fragments, which is how the existing suites are written.

## Build

`npm run build` emits one lazy chunk per lesson body plus a main bundle. The main bundle
trips Vite's 500 kB advisory (Recharts dominates it); the warning is informational.
