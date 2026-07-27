# Poker ITS — Project Specification

## 1. Purpose & Core Design Philosophy

This is an Intelligent Tutoring System (ITS) that teaches poker strategy through a
combination of static diagnostic quizzes and live single-player hands against a bot.

**Core architectural principle: separate stochastic state from deterministic evaluation.**
Getting a bad card is not the same as making a bad decision, and conflating the two causes
cognitive dissonance in learners ("I lost the hand, therefore I played it wrong"). The
backend must always evaluate the *decision* against a mathematical benchmark independently
of the *outcome* of the hand.

**Scope boundary (important):** Full postflop GTO solving is computationally infeasible
in a web request and is explicitly out of scope. The system provides:
- Exact GTO-chart-based preflop guidance (precomputed, static, looked up — not solved live).
- Exact mathematical evaluation on later streets: pot odds, equity vs. a given range,
  minimum defense frequency (MDF), and implied odds — all closed-form or combinatorial
  calculations, not solver output.

Do not attempt to build or embed a real-time postflop solver. If a future milestone wants
closer-to-GTO postflop feedback, the correct approach is to run an existing open-source
solver (e.g. TexasSolver) *offline* to generate static solutions for the fixed scenario
bank, not to solve live.

## 2. Real-Time Behavior — Explicitly Synchronous, Not WebSocket-Based

This is single-player vs. bot, not multiplayer. The bot only ever acts in response to the
player's action, so there is no need for a push-based transport.

- Use plain synchronous HTTP request/response (Django REST Framework).
- On each player action: the backend advances the bot's turn(s) inline within the same
  request/response cycle and returns the fully updated hand state.
- Do **not** implement Django Channels, Redis pub/sub, or WebSockets for this milestone.
- Persist in-progress hand state in the database (or a cache, keyed by session/user) rather
  than in server process memory, so it survives worker restarts and works across multiple
  workers.
- Revisit this decision only if a future milestone adds true multiplayer or a live-action
  clock — neither is in scope now.

## 3. Tech Stack

- **Backend:** Django + Django REST Framework
- **Database:** PostgreSQL (SQLite acceptable for local dev only)
- **Frontend:** Vite + React + Tailwind CSS
- **Charts:** Recharts or Chart.js
- **Hand evaluation:** `treys` or `eval7` (Python) — do not hand-roll poker hand evaluation
- **LLM integration:** Anthropic API, isolated behind a service layer (see Module 5)
- **Testing:** pytest (backend), Vitest or Jest (frontend)
- **Production serving:** gunicorn (WSGI) + WhiteNoise for collected static files, so a
  demo deployment needs no separate static host or CDN

## 4. File Structure

Below is the structure **as built**, which extends the original plan with the Learning
Center (Module 6), Exploit Lab (Module 7) and instructor console (Module 8). Two planned
items were deliberately dropped: `hooks/useGameState.js` (pages own their own fetch/state;
no shared hook earned its keep) and per-component directories (single `.jsx` files
grouped by domain instead).

```
poker-its/
│
├── backend/
│   ├── config/                     # Settings, routing, WSGI
│   ├── requirements.txt
│   ├── .env.example                # LLM API key, DB creds, STAFF_USERNAMES — never commit real .env
│   ├── manage.py
│   └── apps/
│       ├── users/                  # Auth, base profile creation
│       │   ├── management/commands/promote_staff.py   # grants is_staff — see Module 8
│       │   └── tests/
│       ├── student_model/          # BKT engine and student tracking state
│       │   ├── models.py           # Current-state profile (JSONField) — see §5
│       │   ├── observations.py     # Append-only observation log — see §5
│       │   ├── bkt_engine.py       # Pure Python BKT probability updates (no I/O, no ORM calls)
│       │   ├── services.py         # record_skill_observation() — the single mastery write path
│       │   ├── views.py            # API endpoints: fetch profile, submit quiz result, history
│       │   └── tests/
│       │       └── test_bkt_engine.py   # Required: unit tests on known BKT inputs/outputs
│       ├── poker_engine/           # Gameplay state, scenario bank, evaluation math
│       │   ├── hand_eval.py        # Wraps treys; equity & hand-strength calculations
│       │   ├── scenarios.json      # Static hardcoded scenarios (Milestone 1)
│       │   ├── scenario_bank.py    # Single load path for static + generated scenarios
│       │   ├── generators.py       # Procedural per-skill scenario generation (seeded)
│       │   ├── replay.py           # Scripted-hand replay on PokerKit — see GAMEPLAY_QUIZ_INTEGRATION.md
│       │   ├── preflop_charts.py   # Static precomputed GTO preflop range charts
│       │   ├── preflop_mixed_charts.py
│       │   ├── game_loop.py        # Synchronous heads-up dealer/state machine (Milestone 2)
│       │   ├── bot_strategy.py     # Rule-based bot opponent (see §7 — NOT an LLM)
│       │   ├── ev_eval.py          # EV-loss calc: preflop chart deviation + postflop math
│       │   ├── stats.py            # Session aggregation for the Arena stats page
│       │   ├── exploit_profiles.py # Module 7: difficulty tiers, jitter, answer keys
│       │   ├── exploit_stats.py    # Module 7: HUD, spot classification, execution scoring
│       │   ├── exploit_views.py    # Module 7: match lifecycle endpoints
│       │   ├── models.py           # HandHistory (§6), LiveHand, ExploitMatch
│       │   └── tests/
│       ├── admin_analytics/        # Module 8: instructor/researcher API (read-only, staff-gated)
│       │   ├── permissions.py      # IsStaffUser / IsStaffReadOnly
│       │   ├── aggregates.py       # Cohort rollups — constant query count by design
│       │   ├── item_analysis.py    # p-value + discrimination over the observation log
│       │   ├── views.py
│       │   └── tests/
│       └── llm_tutor/              # Generative explanations (Module 5 — STUBBED)
│           ├── prompts.py          # Prompt templates; ground truth injected, never computed by the LLM
│           └── client.py           # Anthropic API service layer: retries, timeouts, caching, rate limiting
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env.example                # API base URL, CORS-related config
    └── src/
        ├── components/
        │   ├── PokerTable.jsx      # Cards, pot, stacks
        │   ├── ActionBar.jsx       # Fold/call/raise — shared by Arena and Exploit Lab
        │   ├── QuizModal.jsx       # Inline diagnostic question overlay
        │   ├── HandReplayModal.jsx # Animated lead-up to the decision point
        │   ├── analytics/          # Progress dashboards (Recharts)
        │   ├── learn/              # Module 6: lesson layout, prose primitives, widgets/
        │   ├── exploit/            # Module 7: HudPanel, DiagnosisModal, MatchReveal
        │   └── admin/              # Module 8: console layout + primitives
        ├── lessons/                # Module 6 curriculum
        │   ├── meta.js             # Slugs, skills, prereqs, anchors — no lesson bodies
        │   ├── registry.jsx        # slug → React.lazy body
        │   ├── math.js             # Pure mirror of ev_eval.py / generators.py (anti-drift)
        │   └── content/            # The eight lesson bodies
        ├── pages/                  # One file per route; pages/admin/ for the console
        ├── services/
        │   └── api.js              # Axios bindings to Django REST endpoints
        ├── constants.js            # Skill labels, mastery gates, chart palette
        ├── App.jsx
        └── main.jsx
```

## 5. Student Model — Data Design (Critical, corrected from earlier draft)

Two separate structures are required. A single JSON blob is **not** sufficient because
Module 4's historical timelines need append-only history, not just current state.

**a) Current-state profile (`StudentProfile`, JSONField)**
Tracks current mastery estimate per skill:
```json
{
  "preflop_range": 0.62,
  "equity_estimation": 0.41,
  "pot_odds": 0.78,
  "implied_odds": 0.35,
  "mdf": 0.55,
  "opponent_reading": 0.28
}
```
(`opponent_reading` was added by Module 7 — see §8.)

**b) Append-only observation log (`SkillObservation`, relational table — build this in
Module 1, not later)**
```
user_id | skill | timestamp | correct (bool) | posterior_after | source | reference_id
```
`source` is one of `"quiz" | "infinite" | "hand" | "exploit"`; `reference_id` records the
question, hand or match that produced the observation, which is what makes Module 8's item
analysis possible at all. This table powers Module 4's dashboards and is impossible to
backfill accurately after the fact — create it from day one even though Module 1 only uses
quizzes.

**BKT parameters:** For each skill, define explicit starting values for P(L0) [prior
knowledge], P(T) [transition/learning rate], P(guess), and P(slip). Hardcode reasonable
defaults for Milestone 1 (document them in a comment block in `bkt_engine.py`) rather than
leaving them unspecified. Do not treat these as an implementation detail to figure out
later — the whole system's correctness depends on them.

**Parameter retune (post-Module 4, applied).** The initial uniform placeholders
(`P(G)=0.25`, `P(T)=0.10` for every skill) let three correct answers in a row master a
skill. Two corrections:

- **P(guess) is item-format-specific.** It is the chance a *non-master* answers correctly,
  and for binary, live-graded skills that is high — a naive "always continue" player
  matches the heads-up button's opening chart ~82% of the time. So near-binary skills
  (`preflop_range`, `pot_odds`, `mdf`) get `P(G) ≈ 0.40–0.45`, while genuine four-option
  quiz items (`equity_estimation`, `implied_odds`, `opponent_reading`) keep `P(G) ≈ 0.25–0.30`.
- **P(T) drops to ~0.05–0.06** so mastery reflects evidence rather than baked-in optimism.

Additionally, a posterior alone is not sufficient evidence: mastery also requires
`MASTERY_MIN_OBSERVATIONS = 5` observations for the skill, so a lucky short streak cannot
master anything. Both the server and the client enforce this, and the frontend renders a
skill with zero observations as "Not started" rather than quoting its untouched prior as
progress.

**Binary-observation mapping for live play (Module 3):** BKT consumes binary
correct/incorrect observations. Live-hand EV loss is continuous. Define an explicit,
documented policy for converting EV loss into a binary observation per skill (e.g. "EV loss
greater than X big blinds in a preflop spot counts as an incorrect `preflop_range`
observation"). This policy must be written down and unit-tested — an implicit or
inconsistent mapping reintroduces the exact cognitive-dissonance problem this architecture
exists to prevent.

## 6. Poker Engine — Data Design

Add a `HandHistory` model (missing from the original plan) to persist every completed hand:
```
user_id | hand_id | timestamp | hole_cards | board | actions[] | pot_size |
preflop_chart_deviation | postflop_ev_loss_by_street | outcome
```
This is required input for both the Module 4 dashboards and the Module 5 Explaining Coach —
without it, neither module has anything to read from.

**Deck RNG:** must support a fixed seed for reproducible tests and reproducible scenario
generation. Do not use unseeded randomness in `game_loop.py`.

## 7. Bot Opponent — Rule-Based, Not LLM (correction from earlier draft)

Use a rule-based bot in `bot_strategy.py` with a small number of adjustable parameters
(e.g. overfold-to-aggression frequency, over-c-bet frequency, range width). This is
deliberately **not** an LLM:
- LLMs play poker weakly and inconsistently.
- Per-action LLM API latency makes live play feel broken.
- A rule-based bot can be tuned to specific exploitable leaks that map directly to the
  skills being taught (e.g. a bot that overfolds to 3-bets teaches the pot-odds/MDF skill
  directly).

Reserve the LLM entirely for **post-hand commentary and explanation** (Module 5), not
gameplay decisions.

## 8. Modularized Roadmap

### Module 1 — Diagnostic Foundation
- `StudentProfile` (current-state JSONField) and `SkillObservation` (append-only log,
  built now even though only quizzes populate it yet).
- `bkt_engine.py`: pure functions, no ORM/database calls inside the math itself. Document
  chosen P(L0)/P(T)/guess/slip defaults.
- `scenarios.json`: static scenarios with exact precomputed answers.
- Unit tests for `bkt_engine.py` against known input/output pairs before moving on.

### Module 2 — Interface & Situational Quizzing
- Vite/React scaffold; `PokerTable` renders static scenarios.
- `QuizModal` triggers on decision points.
- `api.js` (Axios) wiring: submit answer → backend runs BKT update → returns new profile →
  frontend renders immediate feedback.
- Set up CORS configuration between the Vite dev server and Django now, not when it breaks.
- Decide and implement auth (session cookie vs. JWT) for the separate SPA frontend.

### Module 3a — Dealer State Machine + Rule-Based Bot
- `game_loop.py`: synchronous heads-up dealer, seeded RNG, full hand execution
  preflop → river.
- `bot_strategy.py`: rule-based opponent with tunable parameters.
- `hand_eval.py`: wraps `treys`/`eval7` for showdown and equity calculations.
- `HandHistory` model persists every completed hand.

### Module 3b — EV Evaluation
- `preflop_charts.py`: static precomputed range charts for preflop decisions.
- `ev_eval.py`: preflop deviation-from-chart scoring; postflop pot odds / MDF / implied
  odds math (closed-form, not solved).
- Explicit EV-loss → binary-observation mapping policy (§5), unit tested.
- Persistent EV-loss trends lower relevant BKT skill parameters to trigger remediation.

### Module 4 — Analytics Dashboards
- Recharts/Chart.js visualizations reading from `SkillObservation` history (not just
  current-state profile).
- Per-skill tracking bars with mastery-threshold and remediation-trigger markers.

### Module 5 — Generative LLM Integration
- `llm_tutor/client.py`: isolated Anthropic API service layer with retries, timeouts,
  response caching, and rate limiting (this is a per-user cost center — treat it as one).
- `prompts.py`: prompt templates that inject already-computed numeric ground truth
  (EV figures, equity %, GTO chart deviation) and explicitly instruct the model not to
  recompute the math itself. The LLM explains; it never calculates.
- Explaining Coach: triggered on high negative-EV plays, generates a breakdown using the
  injected hand context and EV/GTO figures.
- (Optional, lower priority) LLM-generated *post-hand* commentary only — gameplay decisions
  remain rule-based per §7.

### Module 6 — Learning Center (curriculum / teaching pages)

Rationale: Modules 1–4 measure and drill the five skills but never *teach* them — the only
instructional surface was the rules Tutorial, and quiz explanations were dead ends. Module 6
adds the human-authored curriculum layer of the ITS.

- Frontend-only (no models, migrations, or new endpoints; read-only use of
  `GET /api/poker/ranges/`). Lesson *reading* is deliberately untracked: mastery evidence
  comes exclusively from graded practice via BKT, so lessons link into drills rather than
  claiming completion.
- `/learn` hub + `/learn/<slug>` lesson pages, 8 lessons: one per BKT skill
  (preflop_range, equity_estimation, pot_odds, implied_odds, mdf) plus three supporting
  concepts (EV & decision-vs-outcome, counting outs, bet sizing & alpha). Curriculum
  metadata lives in `frontend/src/lessons/meta.js`; bodies are lazy-loaded per slug.
- **Anti-drift constraint (critical):** every formula and number in lesson prose and
  widgets is computed through `frontend/src/lessons/math.js`, a pure mirror of
  `ev_eval.py` / `generators.py`, pinned by unit tests to backend-emitted values, so
  lessons can never contradict the graders' explanations.
- Interactive widgets per lesson (pot-odds calculator, MDF slider, outs gallery, EV
  explorer, set-mine judge, range ladder, ...) — native inputs, no new dependencies.
- Cross-links: `QuizResultPanel` "Learn more" (all three answer surfaces), Analytics
  remediation "Read the lesson" chip, Dashboard entry card, Infinite Practice skill-row
  lesson link. Sections carry stable anchor ids (`/learn/<slug>#<section>`) so the
  Module 5 Explaining Coach can deep-link lesson material later.

### Module 7 — Exploit Lab (exploitative play)

Rationale: Modules 1–4 teach and grade play against a *benchmark* — charts, pot odds, MDF.
That is half of poker. The other half is adjusting to a specific opponent, and no amount of
GTO drilling teaches it. Module 7 makes the full exploitative loop — *observe → hypothesize
→ adjust → verify* — into first-class graded artifacts.

- `/exploit`: heads-up matches against a **mystery bot** whose leak is hidden and whose
  parameters are jittered per match, so archetypes can't be memorized. Three phases:
  **Scout** (play, accumulate HUD evidence) → **Diagnosis** (commit to a read and a
  counter, both graded) → **Exploit** (demonstrate the adjustment) → full reveal.
- Reuses the Module 3 stack wholesale (`HeadsUpHand`, `LiveHand`, `PokerTable`, the
  existing action endpoint). No multiway engine work; difficulty scales via leak magnitude,
  HUD visibility, and hand budget.
- **GTO grading is off inside matches** (`grading='exploit'`). This is not an optimization —
  the existing grader would record BKT observations punishing exactly the deviations the
  mode teaches (calling below MDF against a maniac is *correct* here).
- Scoring is **variance-free**: diagnosis accuracy plus exploit-execution frequency within
  classified spot classes. Chips won are displayed with the usual variance framing (§1) and
  never graded.
- Adds one BKT skill, `opponent_reading`, fed by the diagnosis checkpoint and the execution
  score. Fewer than three qualifying spots records no observation at all — a card-dead run
  is not evidence of a bad read.
- **Leakage discipline** mirrors the replay endpoint's answer-key rule: no response before
  the match completes may reveal the bot's archetype or parameters.
- Match hands are excluded from Arena aggregates (`match__isnull=True`), or bb/100 and the
  per-profile split silently corrupt.

Full work order: `EXPLOIT_LAB_PLAN.md`.

### Module 8 — Instructor & Research Console

Rationale: the observation log is a research artifact, and an ITS that can't tell an
instructor *which questions are broken* will keep grading students against a miskeyed
answer forever. This module is the read side of everything the other modules write.

- `/admin/*` in the SPA, `/api/admin/` on the server. Access is Django's existing
  `User.is_staff` — one user table, one login, one JWT; the console is a different *view*
  of the same identity, not a parallel account model. `manage.py promote_staff` grants it
  without an interactive shell (accounts still sign up normally, so no password ever lives
  in an environment variable).
- **Read-only by default** (`IsStaffReadOnly`). The console analyses the student model; it
  must never edit it, so a stray write can't corrupt the data the ITS reasons about.
  Authorization is re-decided server-side on every request — the SPA route guard is a UI
  convenience, since the JWT is client-side and the endpoints are directly reachable.
- Surfaces: cohort overview (mastery **distributions**, not means — a bimodal class and an
  average class have identical means), student roster with computed columns, per-student
  drill-down, **classical item analysis**, learning curves, data-health checks, and
  streaming CSV export.
- **Item analysis is the point.** p-value (fraction correct) plus discrimination (the
  correlation between per-item score and the student's accuracy on all *other*
  observations). Negative discrimination is the signature of a miskeyed answer — students
  who understand the material being systematically marked wrong — and nothing else in the
  system catches it. Generated items group by generator family, since per-seed rows would
  all be n=1.
- Aggregation issues a **constant number of queries** regardless of cohort size. The two
  tempting shapes both fail: a per-user loop is an N+1, and a single multi-join
  `annotate()` multiplies counts through the join.

> **Numbering note:** the Exploit Lab was built and labeled "Module 5" in several code
> comments before this document was reconciled. Module 5 here means the LLM tutor, which
> is still unbuilt. The docs use Module 7 = Exploit Lab, Module 8 = instructor console.

## 9. Engineering Scaffolding Checklist (must exist before Module 1 is considered done)

All items complete.

- [x] `requirements.txt` / `pyproject.toml`
- [x] `.env.example` for both backend (LLM API key, DB creds) and frontend (API base URL)
- [x] CORS configuration between Vite and Django
- [x] DRF serializers + chosen auth mechanism — JWT (SimpleJWT) with refresh rotation
- [x] `tests/` directories under every app, with `bkt_engine.py`, `hand_eval.py`, and
      `ev_eval.py` covered before their consuming modules are built
      *(exception: `llm_tutor` has no tests — it is still a stub with nothing to test)*
- [x] Seeded RNG for the deck, used consistently in tests and scenario generation
