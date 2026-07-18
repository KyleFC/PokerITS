# Poker ITS — Implementation Status Report

**Date:** July 11, 2026
**Scope:** Modules 1–4 + Heads Up Arena + Module 6 (Learning Center) + Engineering Scaffolding (per `project.md`)
**Status:** Modules 1, 2, 3a, 3b, 4 and 6 are implemented and tested, along with the Heads Up Arena rebrand + session stats. Module 5 (LLM tutor) is not started.

---

## Executive Summary

The system is a working end-to-end Intelligent Tutoring System:

- ✅ **Module 1 — Diagnostic Foundation:** BKT engine, student profile + append-only observation log, static scenario bank, server-side grading.
- ✅ **Module 2 — Interface & Situational Quizzing:** React SPA with auth, dashboard, quiz modal, scripted hand-replay quizzes, plus two features beyond the original plan: procedurally generated **Infinite Practice** and a poker **Tutorial**.
- ✅ **Module 3a — Dealer State Machine + Rule-Based Bot:** synchronous heads-up dealer on PokerKit, tunable rule-based bot with skill-mapped leaks, DB-persisted in-progress hands, HandHistory on completion.
- ✅ **Module 3b — EV Evaluation:** 6-max + heads-up preflop charts, Monte Carlo equity, closed-form postflop EV, and the documented, unit-tested EV-loss → binary-observation policy feeding BKT.
- ✅ **Module 4 — Analytics Dashboards:** `/analytics` page with per-skill BKT posterior timelines (Recharts) over the observation log, mastery-threshold (0.95) and remediation (0.30 = P(L0)) markers, remediation deep-links into Infinite Practice, and a hand-review list with per-hand EV ground truth.
- ✅ **Heads Up Arena (rebrand + session stats):** Live Play renamed to Heads Up Arena (`/arena`, `/play` redirects), `net_bb`/`bot_profile` persisted per hand, `GET /api/poker/hands/stats/` aggregation, and an `/arena/stats` page framed decisions-first per project.md §1.
- ✅ **Module 6 — Learning Center:** `/learn` curriculum hub + 8 interactive lesson pages (one per BKT skill + EV/decision-quality, counting outs, bet sizing & alpha), lesson math mirrored from the graders and pinned by tests, cross-linked from quiz feedback, analytics remediation, the dashboard, and Infinite Practice. Frontend-only by design (no lesson-progress tracking — mastery evidence stays exclusively BKT-graded practice).
- ❌ **Module 5 — LLM Tutor:** stubbed only. The Learning Center gives it deep-linkable lesson anchors (`/learn/<slug>#<section>`) to cite in explanations.

**Test state:** backend `pytest` — **289 passed, 6 skipped** (skips are intentional: replay decision-button tests that only apply to action-type scenarios). Frontend `vitest` — **48 of 48 pass** (11 files; +32 with Module 6: lesson math drift-alarm, curriculum-registry integrity, hub/lesson page smoke tests, calculator-widget interactions, QuizResultPanel lesson links). No pending migrations (`makemigrations --check` clean). Frontend production build compiles cleanly — each lesson body splits into its own lazy chunk (the one chunk-size warning remains Recharts, informational).

---

## Backend

### Engineering Scaffolding — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `requirements.txt` | ✅ | Django 5, DRF, SimpleJWT, CORS, treys, pokerkit, pytest-django, dj-database-url, python-dotenv, **psycopg[binary] (production PostgreSQL driver)** |
| `.env.example` | ✅ | SECRET_KEY, DEBUG, DATABASE_URL, ANTHROPIC_API_KEY, CORS origins |
| `config/settings.py` | ✅ | JWT auth default, `IsAuthenticated` default permission, CORS, paginated list endpoints (PAGE_SIZE 50), SQLite default / `DATABASE_URL` override. **Production guard:** with `DEBUG=False`, boot fails (`ImproperlyConfigured`) unless a real `SECRET_KEY` and `ALLOWED_HOSTS` are supplied; permissive defaults exist only under `DEBUG=True` |
| CORS Vite ↔ Django | ✅ | Vite dev proxy `/api` → `localhost:8000`; `CORS_ALLOWED_ORIGINS` env-driven |
| Auth mechanism | ✅ | JWT (SimpleJWT) with refresh rotation, now fully wired: the Axios interceptor stores the rotated refresh token, so active sessions no longer hard-expire after 7 days |
| Tests under every app | ✅ | 12 backend test files, 289 passing tests |
| Seeded RNG | ✅ | Per-instance `Deck(seed)` (treys), seeded `random.Random` in generators and game loop; live hands reproducible from their stored seed |

### Users App — ✅ COMPLETE

Custom `User` model, register/login/me endpoints, JWT token pair + refresh, post-save signal auto-creating `StudentProfile`. Covered by `tests/test_auth.py`.

### Student Model App — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `models.py` | ✅ | `StudentProfile` JSONField; starting mastery derived from BKT `P(L0)` so priors can't diverge |
| `observations.py` | ✅ | `SkillObservation` append-only log with `reference_id` and sources `quiz` / `infinite` / `hand` — all three in active use |
| `bkt_engine.py` | ✅ | Pure functions; documented `P(L0)=0.30, P(T)=0.10, P(G)=0.25, P(S)=0.10`, mastery threshold 0.95 |
| `services.py` | ✅ | `record_skill_observation()` — the single write path for mastery updates, shared by quiz grading and live-hand grading |
| `views.py` | ✅ | `GET profile/`, `POST quiz-result/` (server-side grading), `GET history/` (paginated — now consumed by the Module 4 analytics page) |
| Tests | ✅ | `test_bkt_engine.py`, `test_quiz_result.py` |

### Poker Engine App — ✅ COMPLETE (M1 + M2 + M3 + M4 data layer)

| Item | Status | Notes |
|------|--------|-------|
| `scenarios.json` | ✅ | 8 authored scenarios, all with `gameplay` replay scripts |
| `scenario_bank.py` | ✅ | Single load path; resolves both static and generated (`gen:` prefixed) scenario ids |
| `generators.py` | ✅ | Procedural generators for all 5 skills; scenario id encodes `(skill, version, seed)` |
| `replay.py` | ✅ | Scripted-hand replay on PokerKit; emits the shared frame contract; pure (no ORM) |
| `hand_eval.py` | ✅ | treys wrapper + `estimate_equity_monte_carlo()`: seeded rollouts, split-pot-aware true equity |
| `preflop_charts.py` | ✅ | 6-max RFI charts (UTG/HJ/CO/BTN) + heads-up charts: SB/Button open (~82%) and BB defend (~59%) |
| `ev_eval.py` | ✅ | Closed-form call-EV / required-equity / MDF math, preflop chart-deviation scoring, and the EV-loss → binary-observation policy (`EV_LOSS_THRESHOLDS`) |
| `bot_strategy.py` | ✅ | Rule-based bot, pure + deterministic under injected RNG; profiles `balanced` / `nit` / `station` / `maniac` |
| `game_loop.py` | ✅ | Synchronous heads-up dealer (`HeadsUpHand`); `result()['hero_net_bb']` (stack delta in BB) is now persisted for session stats; zero-sum + sign-vs-outcome pinned by tests |
| `models.py` | ✅ | `HandHistory` now also carries **`net_bb`** (Decimal, nullable for pre-field rows) and **`bot_profile`** (migration `0004`) + `LiveHand` (in-progress state) |
| `views.py` / `urls.py` | ✅ | Scenario + live-hand endpoints, plus **`GET hands/history/`** (paginated hand review) and **`GET hands/stats/`** (session aggregation) |
| Tests | ✅ | Previous suites + `TestNetResult` (net-BB semantics) in `test_game_loop.py` and `TestHandStatsAPI` (stats/history endpoints, auth, user scoping, EV-total reconciliation) in `test_live_hand_api.py` |

### LLM Tutor App — ⚠️ STUBBED (Module 5)

`client.py` and `prompts.py` are placeholders. Ground truth for prompt injection (EV figures, chart deviation, hand context) is produced and persisted by Module 3, so Module 5 has its required inputs waiting in `HandHistory`.

---

## API Surface

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/token/`, `/api/token/refresh/` | POST | — | JWT obtain / refresh (rotation fully honored client-side) |
| `/api/auth/register/`, `/api/auth/me/` | POST / GET | — / ✅ | Registration, current user |
| `/api/student/profile/` | GET | ✅ | Current BKT mastery per skill |
| `/api/student/quiz-result/` | POST | ✅ | Server-side grading + BKT update |
| `/api/student/history/` | GET | ✅ | Paginated `SkillObservation` log (drives the Module 4 timelines) |
| `/api/poker/scenarios/` (+ variants) | GET | — | Scenario bank / generate / detail / replay |
| `/api/poker/ranges/` | GET | — | Preflop charts for the range viewer |
| `/api/poker/hands/` | POST | ✅ | Deal a live heads-up hand vs a chosen bot profile |
| `/api/poker/hands/<id>/action/` | POST | ✅ | Apply hero action; bot advances inline; EV-graded observation; writes `HandHistory` (incl. `net_bb`, `bot_profile`) at completion |
| `/api/poker/hands/history/` | GET | ✅ | **New:** paginated completed hands with EV ground truth (Module 4 hand review) |
| `/api/poker/hands/stats/` | GET | ✅ | **New:** session aggregation — cumulative BB and EV-loss timelines, BB/100, record, showdown split, EV loss by street, preflop deviation rate, per-profile split |

---

## Frontend — ✅ COMPLETE through Module 4 + Arena

| Item | Status | Notes |
|------|--------|-------|
| Scaffolding | ✅ | Vite 8 + React 18 + Tailwind 4; dev proxy; production build clean; jsdom `ResizeObserver` stub for Recharts in tests |
| `services/api.js` | ✅ | Axios + JWT interceptor with full refresh rotation; `getFullHistory()` (paginated walk), `getHandStats()`, `getHandHistory()` |
| Pages | ✅ | `Login`, `Register`, `Dashboard`, `Tutorial`, `InfinitePractice` (now supports `?skill=` deep links for remediation), `RangeCharts`, **`HeadsUpArena`** (`/arena`, renamed from LivePlay; links to stats), **`ArenaStats`** (`/arena/stats`), **`Analytics`** (`/analytics`), **`LearnHub`** (`/learn`), **`LearnLesson`** (`/learn/:slug`) |
| Components | ✅ | Previous set + `analytics/SkillTimelineChart` (posterior line, mastery + remediation reference lines, correct/incorrect dots), `analytics/HandReviewList` (decision-quality-first hand table), and the `learn/` family: `LessonLayout`, prose `primitives` (Callout/Formula/WorkedExample/KeyTakeaways), 8 interactive `widgets/` |
| Routes | ✅ | `/`, `/login`, `/register`, `/tutorial`, `/practice`, `/arena`, `/arena/stats`, `/analytics`, `/ranges`, **`/learn`**, **`/learn/:slug`** (unknown slug → hub); `/play` → `/arena` redirect for old links. Nav "Tutorial" entry replaced by "Learn" (Tutorial reachable via the hub's Fundamentals card) |
| Chart palette | ✅ | Single-series charts; palette validated for the slate-900 surface (lightness band, chroma, CVD, ≥3:1 contrast) |
| Tests | ✅ | 16 Vitest tests across 5 files, all passing (incl. `ArenaStats` and `Analytics` page smoke tests; the stale `PokerTable` Bet-badge test now asserts the chip's `aria-label`) |

**Decision-vs-outcome framing on the stats page (project.md §1):** EV metrics lead (tiles and the headline cumulative-EV chart); BB results are present but second, smaller, and labeled as variance ("a downswing here with a flat EV line above means you ran bad, not that you played bad"). The hand review orders decision quality before results for the same reason.

### Module 6 — Learning Center — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `src/lessons/meta.js` | ✅ | Curriculum metadata (slug, skill key, prereqs, section anchor ids) — pure data, importable anywhere without pulling lesson bodies |
| `src/lessons/registry.jsx` | ✅ | slug → `React.lazy` body map; each lesson is its own Vite chunk; meta never imports registry (no cycle) |
| `src/lessons/math.js` | ✅ | **The anti-drift keystone:** pure mirrors of `ev_eval.py` / `generators.py` formulas (required equity, call EV, alpha, MDF, bluff break-even, rule of 2/4, exact draw equities, set-mine ratios, `EV_LOSS_THRESHOLDS`). All lesson prose and widget numbers flow through it |
| `src/lessons/content/` | ✅ | 8 lessons in curriculum order: EV & Decision Quality → Preflop Ranges → Counting Outs → Equity & Rule of 2/4 → Pot Odds → Implied Odds & Set Mining → Bet Sizing & Alpha → MDF. Every skill lesson ends in a "Drill this skill" CTA → `/practice?skill=` |
| `src/components/learn/` | ✅ | `LessonLayout` (sticky section sidebar, prereq chips, prev/next, drill CTA), prose `primitives`, `widgets/` (CallEVExplorer, PotOddsCalculator, EquityRuleExplorer, OutsGallery, MDFSlider, BluffBreakevenExplorer, SetMineJudge, OpeningRangeLadder — the last consumes live `/api/poker/ranges/` with a graceful offline state) |
| Cross-links | ✅ | `QuizResultPanel` "Learn more: {lesson}" (lights up InfinitePractice, QuizModal and HandReplayModal at once), Analytics "Read the lesson" chip beside the remediation drill chip, Dashboard Learning Center entry card, Infinite Practice per-skill "Lesson" link, hub Fundamentals card → `/tutorial` |
| Deep links | ✅ | Every section renders a stable `#anchor` (`/learn/pot-odds#common-mistakes` scrolls); unknown slugs redirect to the hub — ready-made citation targets for the Module 5 coach |
| Tests | ✅ | `math.test.js` pins lesson math to backend-emitted values (the drift alarm); `meta.test.js` pins registry/curriculum integrity (every generatable skill has a lesson, prereqs resolve and precede, unique slugs/anchors); page smoke tests for hub + lesson; widget interaction tests; QuizResultPanel link tests |
| Non-goals (by design) | ✅ | No lesson-progress tracking (reading isn't mastery evidence — BKT-graded practice is); no markdown pipeline or new npm dependencies; no backend changes |

---

## Architectural Invariants (verified in code and tests)

1. **Decision vs. outcome separation (project.md §1):** live-hand decisions are graded by EV math at decision time; win/loss never feeds BKT. The Arena UI and both analytics pages surface EV grades as primary and results as variance.
2. **Server-side grading only:** answer keys and villain cards never reach the client before grading; client-claimed correctness is ignored.
3. **Explicit EV-loss → observation policy (project.md §5):** `ev_eval.EV_LOSS_THRESHOLDS`, each threshold justified in a comment and pinned by tests.
4. **No push transport (project.md §2):** bot acts inline in the request; in-progress hands persist in `LiveHand` rows.
5. **Single mastery write path:** quiz and hand observations both flow through `student_model.services.record_skill_observation`.
6. **Reproducibility:** every generated quiz and every live hand is fully reconstructable from its stored id/seed.
7. **Curriculum can't contradict the graders (Module 6):** every formula/number in lesson prose and widgets is computed through `frontend/src/lessons/math.js`, whose functions mirror `ev_eval.py`/`generators.py` and are pinned to backend-emitted values by `math.test.js`.

---

## Known Issues / Deferred Work

1. **No dependency pinning/lockfile for the backend:** `requirements.txt` uses `>=` ranges. (The frontend has `package-lock.json`.)
2. **Legacy `HandHistory` rows have `net_bb = NULL`:** hands completed before migration `0004` count toward decision-quality stats but contribute 0 BB to results totals. They can be backfilled from `LiveHand.state` (seed + action log) if wanted.
3. **Module 3 scope notes (intentional):** postflop checks/opens (nothing to call) are not graded — only chart-based preflop decisions and facing-a-bet price decisions have closed-form benchmarks. The BB call-vs-3-bet split inside "defend" is likewise out of scope for the binary HU chart.
4. **Analytics history fetch is page-walked client-side** (cap: 20 pages / 1,000 observations). Beyond that, older observations fall off the timelines; a server-side aggregation endpoint would be the fix if volume demands it.
5. **`.claude/settings.local.json` remains tracked** — `.gitignore` now ignores the rest of `.claude/` explicitly and un-ignores that one file to match the existing repo state.

### Fixed since the last report

- Stale `PokerTable` Bet-badge test (chip now has `aria-label="Bet"`; dead `BADGE_STYLES.Bet` removed).
- JWT refresh rotation now stores the rotated refresh token client-side.
- `.gitignore` no longer excludes `*.md` — `project.md` and this document can be version-controlled.
- Production hardening: settings guard for `SECRET_KEY`/`ALLOWED_HOSTS` when `DEBUG=False`; `psycopg[binary]` added for the PostgreSQL production target.
- Dead frontend files removed (`src/style.css`, `src/assets/*`); favicon `<link>` type corrected to `image/x-icon`.

---

## What's Next

### Module 5 — Generative LLM Integration
- `llm_tutor/client.py`: Anthropic API service layer (retries, timeouts, caching, rate limiting).
- `prompts.py`: templates injecting already-computed ground truth (equity %, EV loss, chart deviation from `HandHistory`); the LLM explains, never calculates.
- Explaining Coach triggered on high negative-EV plays — `HandHistory` (now with `net_bb` and `bot_profile`) and the hand-review UI give it both its inputs and a natural surface.
- The Learning Center gives the coach citation targets: `LESSON_BY_SKILL` + section anchor ids let generated explanations end with "read more: /learn/mdf#the-formula".

### Learning Center follow-ons (same scaffolding, purely additive)
- Further lessons: board textures, bluff construction, variance/bankroll math, hand reading.
- Optional lesson-progress tracking if product wants read-state on the hub (deliberately excluded from Module 6).

---

## Conclusion

**Modules 1–4, the Heads Up Arena, and Module 6 are functionally complete and tested.** The full learning loop now closes with a teaching layer: interactive lessons for every graded skill → diagnostic quizzes → adaptive infinite practice → live heads-up play with EV-graded decisions → analytics that show each skill's mastery trajectory and flag skills for remediation, deep-linking both back into targeted drills *and* into the lesson that teaches the concept. Quiz explanations are no longer dead ends — every graded answer links to its skill's lesson. Module 5 has all its required data waiting in `HandHistory`, plus lesson anchors to cite.
