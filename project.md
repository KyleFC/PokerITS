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

## 4. File Structure

```
poker-its/
│
├── backend/
│   ├── config/                     # Settings, routing, WSGI/ASGI config
│   ├── requirements.txt            # or pyproject.toml
│   ├── .env.example                # LLM API key, DB creds, etc. — never commit real .env
│   ├── manage.py
│   └── apps/
│       ├── users/                  # Auth, base profile creation
│       │   └── tests/
│       ├── student_model/          # BKT engine and student tracking state
│       │   ├── models.py           # Current-state profile (JSONField) — see §5
│       │   ├── observations.py     # models.py addition: append-only observation log — see §5
│       │   ├── bkt_engine.py       # Pure Python BKT probability updates (no I/O, no ORM calls)
│       │   ├── views.py            # API endpoints: fetch profile, submit quiz/hand result
│       │   └── tests/
│       │       └── test_bkt_engine.py   # Required: unit tests on known BKT inputs/outputs
│       ├── poker_engine/           # Gameplay state, scenario bank, evaluation math
│       │   ├── hand_eval.py        # Wraps treys/eval7; equity & hand-strength calculations
│       │   ├── scenarios.json      # Static hardcoded scenarios (Milestone 1)
│       │   ├── preflop_charts.py   # Static precomputed GTO preflop range charts
│       │   ├── game_loop.py        # Synchronous heads-up dealer/state machine (Milestone 2)
│       │   ├── bot_strategy.py     # Rule-based bot opponent (see §7 — NOT an LLM)
│       │   ├── ev_eval.py          # EV-loss calc: preflop chart deviation + postflop math
│       │   ├── models.py           # HandHistory model — see §6
│       │   └── tests/
│       │       ├── test_hand_eval.py
│       │       ├── test_game_loop.py
│       │       └── test_ev_eval.py
│       └── llm_tutor/               # Generative explanations + rule-based adversarial bot
│           ├── prompts.py           # Prompt templates; numeric ground truth injected, never computed by the LLM
│           ├── client.py            # Anthropic API service layer: retries, timeouts, caching, rate limiting
│           └── tests/
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env.example                # API base URL, CORS-related config
    └── src/
        ├── components/
        │   ├── PokerTable/          # Cards, pot, stacks, action buttons
        │   ├── QuizModal/           # Inline diagnostic question overlay
        │   └── Analytics/           # Progress dashboards (Recharts/Chart.js)
        ├── hooks/
        │   └── useGameState.js      # Frontend poker action + quiz-sync state management
        ├── services/
        │   └── api.js               # Axios bindings to Django REST endpoints
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
  "mdf": 0.55
}
```

**b) Append-only observation log (`SkillObservation`, relational table — build this in
Module 1, not later)**
```
user_id | skill | timestamp | correct (bool) | posterior_after | source ("quiz" | "hand")
```
This table is what powers Module 4's dashboards and is impossible to backfill accurately
after the fact — create it from day one even though Module 1 only uses quizzes.

**BKT parameters:** For each of the 5 skills, define explicit starting values for
P(L0) [prior knowledge], P(T) [transition/learning rate], P(guess), and P(slip). Hardcode
reasonable defaults for Milestone 1 (document them in a comment block in `bkt_engine.py`)
rather than leaving them unspecified. Do not treat these as an implementation detail to
figure out later — the whole system's correctness depends on them.

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

## 9. Engineering Scaffolding Checklist (must exist before Module 1 is considered done)

- [ ] `requirements.txt` / `pyproject.toml`
- [ ] `.env.example` for both backend (LLM API key, DB creds) and frontend (API base URL)
- [ ] CORS configuration between Vite and Django
- [ ] DRF serializers + chosen auth mechanism
- [ ] `tests/` directories under every app, with `bkt_engine.py`, `hand_eval.py`, and
      `ev_eval.py` covered before their consuming modules are built
- [ ] Seeded RNG for the deck, used consistently in tests and scenario generation
