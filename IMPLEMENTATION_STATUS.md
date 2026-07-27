# Poker ITS — Implementation Status Report

**Date:** July 26, 2026
**Scope:** Modules 1–4, 6, 7 (Exploit Lab) and 8 (Instructor & Research Console) + Heads Up Arena + engineering scaffolding, per `project.md`
**Status:** Everything on the roadmap is implemented and tested **except Module 5 (LLM tutor)**, which remains a stub.

---

## Executive Summary

The system is a complete, working Intelligent Tutoring System with a teaching layer, four
practice modes, learner-facing analytics, and an instructor console.

- ✅ **Module 1 — Diagnostic Foundation:** BKT engine, student profile + append-only observation log, static scenario bank, server-side grading.
- ✅ **Module 2 — Interface & Situational Quizzing:** React SPA with JWT auth, dashboard, quiz modal, scripted hand-replay quizzes, plus procedurally generated **Infinite Practice** and a rules **Tutorial**.
- ✅ **Module 3a — Dealer State Machine + Rule-Based Bot:** synchronous heads-up dealer on PokerKit, tunable rule-based bot with skill-mapped leaks, DB-persisted in-progress hands, `HandHistory` on completion.
- ✅ **Module 3b — EV Evaluation:** 6-max + heads-up preflop charts, Monte Carlo equity, closed-form postflop EV, and the documented, unit-tested EV-loss → binary-observation policy feeding BKT.
- ✅ **Module 4 — Analytics Dashboards:** `/analytics` with per-skill BKT posterior timelines, mastery (0.95) and remediation (0.30) markers, remediation deep-links into Infinite Practice, and a hand-review list with per-hand EV ground truth.
- ✅ **Heads Up Arena:** `/arena` (`/play` redirects), `net_bb`/`bot_profile` per hand, `GET /api/poker/hands/stats/`, and an `/arena/stats` page framed decisions-first per project.md §1.
- ✅ **Module 6 — Learning Center:** `/learn` hub + 8 interactive lesson pages, lesson math mirrored from the graders and pinned by tests, cross-linked from quiz feedback, analytics remediation, the dashboard, and Infinite Practice.
- ✅ **Module 7 — Exploit Lab:** `/exploit` Scout → Diagnosis → Exploit matches against a jittered mystery bot, variance-free scoring, and the sixth tracked skill `opponent_reading`. GTO grading is deliberately off inside matches.
- ✅ **Module 8 — Instructor & Research Console:** `/admin/*` staff-gated dashboard — cohort KPIs, student roster, per-student drill-down, classical item analysis, learning curves, data-health checks, and streaming CSV export.
- ❌ **Module 5 — LLM Tutor:** stubbed only (`client.py` raises `NotImplementedError`, `prompts.py` is an empty template dict).

**Test state:** backend `pytest` — **418 passed, 6 skipped** across 18 test modules (the
skips are intentional: replay decision-button assertions that only apply to action-type
scenarios). Frontend `vitest` — **101 passed** across 17 files. No pending migrations
(`makemigrations --check` clean). Production build compiles cleanly — each lesson body
splits into its own lazy chunk; the one chunk-size warning is Recharts in the main bundle
and is informational.

---

## Backend

### Engineering Scaffolding — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `requirements.txt` | ✅ | Django 5, DRF, SimpleJWT, CORS, treys, pokerkit, pytest-django, dj-database-url, python-dotenv, psycopg[binary], gunicorn, whitenoise |
| `.env.example` | ✅ | `SECRET_KEY`, `DEBUG`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, CORS origins, `STAFF_USERNAMES` |
| `config/settings.py` | ✅ | JWT default auth, `IsAuthenticated` default permission, CORS, `PAGE_SIZE` 50, SQLite default / `DATABASE_URL` override. **Production guard:** with `DEBUG=False`, boot fails (`ImproperlyConfigured`) without a real `SECRET_KEY` and `ALLOWED_HOSTS` |
| CORS Vite ↔ Django | ✅ | Vite dev proxy `/api` → `localhost:8000`; `CORS_ALLOWED_ORIGINS` env-driven |
| Auth | ✅ | SimpleJWT with refresh rotation; the Axios interceptor stores the rotated refresh token, so sessions don't hard-expire |
| Static serving | ✅ | WhiteNoise middleware + `CompressedManifestStaticFilesStorage`; no separate static host needed |
| Tests under every app | ✅ | 18 test modules, 418 passing tests |
| Seeded RNG | ✅ | Per-instance `Deck(seed)`, seeded `random.Random` in generators, game loop, and Exploit Lab jitter; every hand and match reconstructs from its stored seed |

### Users App — ✅ COMPLETE

Custom `User`, register/login/me endpoints, JWT pair + refresh, post-save signal creating
`StudentProfile`. Adds the **`promote_staff` management command** (Module 8): grants or
revokes `is_staff` on already-registered accounts, reading `STAFF_USERNAMES` when called
with no arguments so it can be chained into a deploy step. Idempotent, and non-fatal on an
unknown username (`--strict` to override) so a typo can't fail a deploy. Covered by
`tests/test_auth.py` and `tests/test_promote_staff.py`.

### Student Model App — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `models.py` | ✅ | `StudentProfile` JSONField; `DEFAULT_SKILLS` derives starting mastery from each skill's `P(L0)` so priors can't diverge. Six skills incl. `opponent_reading` |
| `observations.py` | ✅ | `SkillObservation` append-only log with `reference_id`; sources `quiz` / `infinite` / `hand` / `exploit` — all four in active use |
| `bkt_engine.py` | ✅ | Pure functions. **Params retuned per skill** (see below) + `MASTERY_MIN_OBSERVATIONS = 5`; `BKTParams` validates identifiability bounds at construction |
| `services.py` | ✅ | `record_skill_observation()` — the single write path for mastery updates, shared by quiz, practice, live-hand and Exploit Lab grading |
| `views.py` | ✅ | `GET profile/` (now including `skill_observations` counts), `POST quiz-result/`, `GET history/` (paginated) |
| Tests | ✅ | `test_bkt_engine.py`, `test_quiz_result.py` |

**BKT parameters (retuned from the original uniform placeholders):**

| Skill | P(L0) | P(T) | P(G) | P(S) |
|-------|-------|------|------|------|
| `preflop_range` | 0.35 | 0.06 | 0.45 | 0.10 |
| `equity_estimation` | 0.25 | 0.06 | 0.30 | 0.12 |
| `pot_odds` | 0.30 | 0.06 | 0.45 | 0.10 |
| `mdf` | 0.25 | 0.05 | 0.40 | 0.12 |
| `implied_odds` | 0.20 | 0.05 | 0.30 | 0.12 |
| `opponent_reading` | 0.20 | 0.10 | 0.30 | 0.12 |

The uniform placeholders (`P(G)=0.25`, `P(T)=0.10` everywhere) let three correct answers
in a row master a skill. Two fixes: guess rate is now item-format-specific — near-binary
live-graded skills get `P(G) ≈ 0.40–0.45` because a naive "always continue" player is
right most of the time (the heads-up button opens ~82% of hands), while genuine 4-option
quiz items keep `P(G) ≈ 0.25–0.30` — and `P(T)` drops to ~0.05–0.06 so mastery tracks
evidence rather than baked-in optimism. Mastery now also requires
**`MASTERY_MIN_OBSERVATIONS = 5`** regardless of posterior, so a lucky streak cannot master
a skill on thin evidence. Rationale is in the `bkt_engine.py` docstring; the frontend
mirrors these in `constants.js` for display only.

### Poker Engine App — ✅ COMPLETE (M1 + M2 + M3 + M4 data layer + M7)

| Item | Status | Notes |
|------|--------|-------|
| `scenarios.json` | ✅ | 8 authored scenarios, all with `gameplay` replay scripts |
| `scenario_bank.py` | ✅ | Single load path; resolves static and generated (`gen:`) scenario ids |
| `generators.py` | ✅ | Procedural generators for all 5 drillable skills; scenario id encodes `(skill, version, seed)` |
| `replay.py` | ✅ | Scripted-hand replay on PokerKit; emits the shared frame contract; pure (no ORM) |
| `hand_eval.py` | ✅ | treys wrapper + `estimate_equity_monte_carlo()`: seeded rollouts, split-pot-aware |
| `preflop_charts.py` / `preflop_mixed_charts.py` | ✅ | 6-max RFI charts (UTG/HJ/CO/BTN) + heads-up: SB/Button open (~82%), BB defend (~59%) |
| `ev_eval.py` | ✅ | Closed-form call-EV / required-equity / MDF math, preflop chart-deviation scoring, and `EV_LOSS_THRESHOLDS` |
| `bot_strategy.py` | ✅ | Rule-based bot, pure + deterministic under injected RNG; profiles `balanced` / `nit` / `station` / `maniac`. **M7 additions:** `profile_params()`, `jittered_profile()`, and `RuleBasedBot` accepting a `BotProfile` instance directly |
| `game_loop.py` | ✅ | Synchronous heads-up dealer (`HeadsUpHand`); `hero_net_bb` persisted for stats. **M7 additions:** `bot_params` injection, `grading='gto'\|'exploit'` mode, `_decision_context()`; `serialize()`/`restore()` round-trip both with back-compatible defaults |
| `exploit_profiles.py` | ✅ | **New (M7):** difficulty tiers, leak exaggeration + jitter, diagnosis answer keys, biased hand-seed selection (capped candidate search — never an unbounded loop in a request) |
| `exploit_stats.py` | ✅ | **New (M7):** HUD aggregation, spot classification, execution scoring. Pure (no ORM) |
| `exploit_views.py` | ✅ | **New (M7):** match lifecycle endpoints, kept out of the already-large `views.py` |
| `stats.py` | ✅ | Session aggregation; filters `match__isnull=True` so Exploit Lab hands can't corrupt Arena bb/100 or per-profile splits |
| `models.py` | ✅ | `HandHistory` (+ `net_bb`, `bot_profile`, `match` FK), `LiveHand` (+ `match` FK), **`ExploitMatch`** (migration `0005`) |
| `views.py` / `urls.py` | ✅ | Scenario, live-hand, ranges, history/stats endpoints + the `LiveHandActionView` match hook |
| Tests | ✅ | 13 modules incl. `test_exploit_profiles.py`, `test_exploit_stats.py` (with the detectability gate), `test_exploit_api.py` |

### Admin Analytics App — ✅ COMPLETE (Module 8)

Read-only instructor/researcher API at `/api/admin/`, gated on `User.is_staff` — the flag
`AbstractUser` already carries, rather than a parallel account model. One user table, one
login, one JWT; the console is a different *view* of the same identity.

| Item | Status | Notes |
|------|--------|-------|
| `permissions.py` | ✅ | `IsStaffUser` and `IsStaffReadOnly`. Read-only by default: the console analyses the student model and must never edit it, so a stray write can't corrupt the data the ITS reasons about |
| `aggregates.py` | ✅ | Cohort overview, roster, per-student detail, learning curves. **Constant query count regardless of cohort size** — each source table is grouped separately and stitched by user id in Python, avoiding both the N+1 loop and the join-multiplication bug a multi-join `annotate()` produces |
| `item_analysis.py` | ✅ | Classical p-value + discrimination per item. Discrimination is the Pearson correlation between per-item score and the student's accuracy on all *other* observations — **negative discrimination is the signature of a miskeyed answer**, which manual re-reading of a bank does not reliably catch. Generated items group by generator family (per-seed rows would all be n=1) |
| `views.py` | ✅ | 7 endpoints incl. streaming CSV export (the observation log grows without bound, and a research export is exactly the request that asks for all of it) |
| Tests | ✅ | `tests/test_admin_api.py` — 26 tests covering access control, aggregation correctness, sorting, and export |

### LLM Tutor App — ⚠️ STUBBED (Module 5)

`client.py` raises `NotImplementedError`; `prompts.py` holds an empty template dict. No
tests directory yet. All of its required inputs already exist: EV figures, chart deviation
and hand context are computed and persisted by Module 3, and the Learning Center provides
`/learn/<slug>#<anchor>` citation targets.

---

## API Surface

### Student-facing

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/token/`, `/api/token/refresh/` | POST | — | JWT obtain / refresh (rotation honored client-side) |
| `/api/auth/register/`, `/api/auth/me/` | POST / GET | — / ✅ | Registration, current user (incl. `is_staff`) |
| `/api/student/profile/` | GET | ✅ | Current BKT mastery per skill + per-skill observation counts |
| `/api/student/quiz-result/` | POST | ✅ | Server-side grading + BKT update |
| `/api/student/history/` | GET | ✅ | Paginated `SkillObservation` log (drives the analytics timelines) |
| `/api/poker/scenarios/` (+ `generate/`, `<id>/`, `<id>/replay/`) | GET/POST | — | Scenario bank, procedural generation, detail, replay frames |
| `/api/poker/ranges/` | GET | — | Preflop charts for the range viewer |
| `/api/poker/hands/` | POST | ✅ | Deal a live heads-up hand vs a chosen bot profile |
| `/api/poker/hands/<id>/action/` | POST | ✅ | Apply hero action; bot advances inline; EV-graded observation; writes `HandHistory` at completion |
| `/api/poker/hands/history/` | GET | ✅ | Paginated completed hands with EV ground truth |
| `/api/poker/hands/stats/` | GET | ✅ | Session aggregation — cumulative BB and EV-loss timelines, bb/100, record, showdown split, EV loss by street, preflop deviation rate, per-profile split |

### Exploit Lab (Module 7)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/poker/exploit/matches/` | POST | ✅ | Create a match (enters Scout phase) |
| `/api/poker/exploit/matches/<id>/` | GET | ✅ | Match state; full reveal only once `phase == 'complete'` |
| `/api/poker/exploit/matches/<id>/hands/` | POST | ✅ | Deal or resume a match hand (idempotent) |
| `/api/poker/exploit/matches/<id>/diagnosis/` | POST | ✅ | Grade the read + the counter; records two `opponent_reading` observations |

Hero *actions* reuse `/api/poker/hands/<id>/action/`; the view calls back into
`exploit_views.on_match_hand_action()` to record the decision context and advance phases.

### Instructor console (Module 8) — all `GET`, all staff-only

| Endpoint | Purpose |
|----------|---------|
| `/api/admin/overview/` | Cohort KPIs, per-skill mastery distributions, activity timeline (`?days=`) |
| `/api/admin/users/` | Student roster with computed columns (`?q=`, `?sort=`, `?order=`, `?page=`, `?page_size=`) |
| `/api/admin/users/<id>/` | Per-student drill-down: mastery, timelines, hands, matches |
| `/api/admin/items/` | p-value + discrimination per quiz item, with quality flags (`?min_attempts=`) |
| `/api/admin/curves/` | Cohort accuracy vs. attempt number per skill (`?max_opportunity=`) |
| `/api/admin/health/` | Abandoned sessions, row counts, data-integrity checks (`?stale_hours=`) |
| `/api/admin/export/` | Streaming CSV — `?dataset=observations\|hands\|users` |

---

## Frontend — ✅ COMPLETE through Module 8

| Item | Status | Notes |
|------|--------|-------|
| Scaffolding | ✅ | Vite 7 + React 18 + Tailwind 4; dev proxy; production build clean; jsdom `ResizeObserver` stub for Recharts |
| `services/api.js` | ✅ | Axios + JWT interceptor with refresh rotation; `authService`, `studentService`, `pokerService`, `exploitService`, `adminService` |
| Pages | ✅ | `Login`, `Register`, `Dashboard`, `Tutorial`, `InfinitePractice` (`?skill=` deep links), `RangeCharts`, `HeadsUpArena`, `ArenaStats`, `ExploitLab`, `Analytics`, `LearnHub`, `LearnLesson`, and `admin/` (`AdminOverview`, `AdminUsers`, `AdminUserDetail`, `AdminItems`, `AdminCurves`, `AdminHealth`) |
| Components | ✅ | `PokerTable`, `PokerCard`, `ActionBar` (extracted and shared by Arena + Exploit Lab), quiz/replay modals, `analytics/` (`SkillTimelineChart`, `HandReviewList` — reused by the admin drill-down), `learn/` (layout, prose primitives, 8 widgets), `exploit/` (`HudPanel`, `DiagnosisModal`, `MatchReveal`), `admin/` (`AdminLayout`, primitives) |
| Routes | ✅ | `/`, `/login`, `/register`, `/tutorial`, `/practice`, `/arena`, `/arena/stats`, `/exploit`, `/analytics`, `/ranges`, `/learn`, `/learn/:slug`, `/admin/*`; `/play` → `/arena` redirect |
| Chart palette | ✅ | Single-series charts; palette validated for the slate-900 surface (lightness band, chroma, CVD, ≥3:1 contrast) |
| Tests | ✅ | 101 Vitest tests across 17 files |

**Decision-vs-outcome framing (project.md §1):** EV metrics lead on the stats page (tiles
and the headline cumulative-EV chart); BB results are present but second, smaller, and
labeled as variance. The hand review orders decision quality before results, and the
Exploit Lab reveal shows the chips result last.

### Module 6 — Learning Center — ✅ COMPLETE

| Item | Status | Notes |
|------|--------|-------|
| `src/lessons/meta.js` | ✅ | Curriculum metadata (slug, skill key, prereqs, anchor ids) — pure data, importable without pulling lesson bodies |
| `src/lessons/registry.jsx` | ✅ | slug → `React.lazy` body map; one Vite chunk per lesson; meta never imports registry (no cycle) |
| `src/lessons/math.js` | ✅ | **The anti-drift keystone:** pure mirrors of `ev_eval.py` / `generators.py` (required equity, call EV, alpha, MDF, bluff break-even, rule of 2/4, exact draw equities, set-mine ratios, `EV_LOSS_THRESHOLDS`) |
| `src/lessons/content/` | ✅ | 8 lessons in curriculum order: EV & Decision Quality → Preflop Ranges → Counting Outs → Equity & Rule of 2/4 → Pot Odds → Implied Odds & Set Mining → Bet Sizing & Alpha → MDF |
| Cross-links | ✅ | `QuizResultPanel` "Learn more", Analytics "Read the lesson" chip, Dashboard entry card, Infinite Practice per-skill link, hub Fundamentals card → `/tutorial` |
| Deep links | ✅ | Every section renders a stable `#anchor`; unknown slugs redirect to the hub |
| Non-goals (by design) | ✅ | No lesson-progress tracking (reading isn't mastery evidence), no markdown pipeline, no new npm dependencies, no backend changes |

### Module 7 — Exploit Lab — ✅ COMPLETE

Three phases per match — **Scout** (play the mystery bot, accumulate HUD evidence),
**Diagnosis** (commit to a read and a counter, both graded), **Exploit** (demonstrate the
adjustment) — ending in a full reveal.

| Item | Status | Notes |
|------|--------|-------|
| Difficulty tiers | ✅ | `easy` (blatant leaks, live HUD, 25 scout hands) / `medium` (true-to-life, HUD at checkpoint only, `balanced` in the pool) / `hard` (subtle, no HUD) |
| Jitter | ✅ | Params sampled around an archetype per match so archetypes can't be memorized; tests assert jitter **never crosses an archetype boundary**, which is what makes the diagnosis answer key honest |
| Grading mode | ✅ | `grading='exploit'` disables GTO grading inside matches — the existing grader would penalize exactly the deviations this mode teaches. Not an optimization; the pedagogy |
| Scoring | ✅ | Variance-free: diagnosis accuracy + exploit-execution frequency in classified spot classes. Chips are displayed, never graded |
| Leakage discipline | ✅ | No pre-complete response reveals `base_profile`, `bot_params`, or a profile name; medium/hard strip villain cards from non-showdown hands. Pinned by tests that `json.dumps` every pre-complete payload |
| Isolation | ✅ | Match hands are excluded from Arena stats/history via `match__isnull=True` |
| Detectability gate | ✅ | A seeded simulation asserts each easy-tier archetype's leak-defining HUD stat separates from the others by a margin — the test that guards the mode being winnable at all |
| BKT | ✅ | `opponent_reading`: 2 observations at diagnosis + 0–1 at completion. Fewer than 3 qualifying spots records **no** observation — a card-dead run isn't evidence of a bad read |

### Module 8 — Instructor & Research Console — ✅ COMPLETE

`/admin/*`, staff-only. The SPA guard decides what renders; the API re-checks `is_staff` on
every request and 403s a non-staff caller regardless, because the JWT is client-side and
the endpoints are directly reachable.

| Page | Shows |
|------|-------|
| `AdminOverview` | Cohort KPIs, registered-vs-engaged split, per-skill mastery **histograms** (a distribution, not a mean — a bimodal class and an average class look identical in a mean), observation sources, activity timeline |
| `AdminUsers` | Sortable roster: last active, answers, accuracy, mean mastery, skills mastered, hands, bb/100 |
| `AdminUserDetail` | One student's mastery timelines and hand review, reusing the student-facing analytics components |
| `AdminItems` | Item analysis with flags: possible miskey, too easy, too hard, weak discrimination, low volume |
| `AdminCurves` | Cohort accuracy vs. attempt number per skill; thin-sample points drawn faintly rather than dropped, so a thinning tail reads as a tail rather than vanishing |
| `AdminHealth` | Open/stale live hands, matches abandoned by phase (which marks where students give up), row counts, integrity checks |

---

## Architectural Invariants (verified in code and tests)

1. **Decision vs. outcome separation (project.md §1):** live-hand decisions are graded by EV math at decision time; win/loss never feeds BKT. Every results surface frames chips as variance.
2. **Server-side grading only:** answer keys and villain cards never reach the client before grading; client-claimed correctness is ignored.
3. **Explicit EV-loss → observation policy (project.md §5):** `ev_eval.EV_LOSS_THRESHOLDS`, each threshold justified in a comment and pinned by tests.
4. **No push transport (project.md §2):** the bot acts inline in the request; in-progress hands persist in `LiveHand` rows.
5. **Single mastery write path:** quiz, practice, hand and Exploit Lab observations all flow through `student_model.services.record_skill_observation`.
6. **Reproducibility:** every generated quiz, live hand, and Exploit Lab match reconstructs from its stored id/seed.
7. **Curriculum can't contradict the graders (Module 6):** every number in lesson prose and widgets is computed through `frontend/src/lessons/math.js`, pinned to backend-emitted values by `math.test.js`.
8. **Exploit Lab is isolated (Module 7):** no GTO grading inside matches, no bot identity before completion, and match hands excluded from Arena aggregates.
9. **The instructor console never writes (Module 8):** `IsStaffReadOnly` by default, so analysis can't corrupt the student model.
10. **Mastery requires evidence, not just a posterior:** `MASTERY_MIN_OBSERVATIONS = 5` gates the claim on both server and client.

---

## In-Flight (uncommitted working tree)

A UI-honesty pass on how mastery is presented before a student has answered anything:

- `constants.js` adds `attemptsForSkill(profile, skill)`; `SkillCard`, `Dashboard`,
  `InfinitePractice` and `LearnHub` use it. With **0** observations a skill now reads
  "Not started" with an empty bar and a caption explaining the number is the tutor's
  starting assumption, not earned progress — a tester had read the filled prior bar on a
  fresh account as another user's data leaking in. Low-evidence skills say how many answers
  back the estimate.
- `Dashboard` gates the raw "Show Details" BKT component values (slip/guess/transition)
  behind `is_staff` — for a student they read as unexplained jargon next to their own
  score. The params ship in the client bundle regardless, so this is clarity, not secrecy.
- Test coverage added in `SkillCard.test.jsx`, `LearnHub.test.jsx`, and a new
  `Dashboard.test.jsx`. All 101 frontend tests pass with these applied.

---

## Known Issues / Deferred Work

1. **No dependency pinning for the backend:** `requirements.txt` uses `>=` ranges. (The frontend has `package-lock.json`.)
2. **Legacy `HandHistory` rows have `net_bb = NULL`:** hands completed before migration `0004` count toward decision-quality stats but contribute 0 BB to results totals. `/api/admin/health/` reports the count; they can be backfilled from `LiveHand.state` if wanted.
3. **Module 3 scope notes (intentional):** postflop checks/opens (nothing to call) are not graded — only chart-based preflop decisions and facing-a-bet price decisions have closed-form benchmarks. The BB call-vs-3-bet split inside "defend" is likewise out of scope for the binary HU chart.
4. **Analytics history fetch is page-walked client-side** (cap: 20 pages / 1,000 observations). Beyond that, older observations fall off the learner's timelines. The instructor console aggregates server-side and is unaffected.
5. **Admin roster loads every user and merges in memory.** Correct for a classroom cohort (tens to low hundreds) and what makes computed columns sortable; serving thousands of students needs DB-level pagination before the merge.
6. **`llm_tutor` has no `tests/` directory** — the only app without one, since there is nothing to test yet.
7. **Module numbering is ambiguous in code comments.** The Exploit Lab shipped labeled "Module 5" in several docstrings (`exploit_views.py`, `game_loop.py`, `constants.js`, `bkt_engine.py`), but project.md's Module 5 is the LLM tutor. The docs now call the Exploit Lab **Module 7** and the instructor console **Module 8**; the in-code comments have not been renamed.
8. **`.claude/settings.local.json` remains tracked** — `.gitignore` ignores the rest of `.claude/` and un-ignores that one file to match the existing repo state.

### Fixed since the last report (July 11)

- BKT parameters retuned per skill with documented rationale, plus `MASTERY_MIN_OBSERVATIONS` gating mastery on evidence volume.
- `StudentProfile` payload now carries per-skill observation counts, so the UI can distinguish a prior from earned progress.
- `ActionBar` extracted from `HeadsUpArena` and shared with the Exploit Lab.
- Production serving added (`gunicorn`, `whitenoise`, `collectstatic`) and a `promote_staff` command for granting instructor access without an interactive shell.

---

## What's Next

### Module 5 — Generative LLM Integration (the only unbuilt roadmap item)

- `llm_tutor/client.py`: Anthropic API service layer (retries, timeouts, caching, rate limiting) — a per-user cost center, so treat it as one.
- `prompts.py`: templates injecting already-computed ground truth (equity %, EV loss, chart deviation from `HandHistory`); the LLM explains, never calculates.
- Explaining Coach triggered on high negative-EV plays. `HandHistory` and the hand-review UI give it both its inputs and a natural surface; `LESSON_BY_SKILL` + section anchors give it citation targets ("read more: /learn/mdf#the-formula").
- The Exploit Lab reveal is a second natural surface: the full hand log with villain cards is exactly the material a coach would narrate.

### Additive follow-ons

- Further lessons: board textures, bluff construction, variance/bankroll math, hand reading.
- Exploit Lab stretch goals (from its plan §13): hybrid/street-dependent leak profiles, per-decision exploit-EV via Monte Carlo, drifting profiles that adjust mid-match.
- Backend dependency pinning; server-side aggregation for the learner analytics timelines if observation volume outgrows the page-walk cap.

---

## Conclusion

**Modules 1–4 and 6–8 are functionally complete and tested.** The learning loop closes
end to end: lessons teach every graded skill → diagnostic quizzes and adaptive practice
drill them → live heads-up play grades real decisions on EV → the Exploit Lab trains the
observe-hypothesize-adjust cycle the GTO material can't → analytics show each skill's
trajectory and flag remediation, deep-linking back into both drills and lessons → and the
instructor console turns the whole cohort's observation log into item analysis, learning
curves, and exportable research data. Module 5 remains the single outstanding item, with
all of its required inputs already produced and persisted.
