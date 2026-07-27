# Poker ITS

An **Intelligent Tutoring System** for no-limit hold'em. It measures what a student
actually knows with Bayesian Knowledge Tracing, teaches the concepts behind each skill,
drills them with procedurally generated practice, grades live decisions against
mathematical benchmarks, and gives instructors a research-grade view of the whole cohort.

**Django + DRF** backend, **Vite + React + Tailwind** SPA, **PostgreSQL** in production
(SQLite for local dev).

---

## The core idea

> Getting a bad card is not the same as making a bad decision.

Every graded decision in the system is evaluated against a *mathematical benchmark at
decision time* — chart deviation, pot odds, required equity, MDF — never against whether
the hand was won. Results are shown, but they are framed as variance and never feed the
student model. Conflating the two is what makes learners conclude "I lost, therefore I
misplayed it," and the architecture exists to prevent exactly that.

The second constraint: **the system never solves poker live.** Preflop guidance is
precomputed chart lookup; postflop evaluation is closed-form or combinatorial math
(pot odds, equity vs. a range, MDF, implied odds). There is no embedded solver, by design.

---

## What's in it

| Area | Route | What it does |
|------|-------|--------------|
| **Dashboard** | `/` | Per-skill BKT mastery, entry points to every mode |
| **Learning Center** | `/learn`, `/learn/:slug` | 8 interactive lessons — one per graded skill plus supporting concepts |
| **Tutorial** | `/tutorial` | Rules primer for players new to hold'em |
| **Diagnostic quizzes** | `/` | Authored scenarios, played out as an animated hand replay to the decision point |
| **Infinite Practice** | `/practice` | Procedurally generated, per-skill drills; seeded and reproducible |
| **Heads Up Arena** | `/arena`, `/arena/stats` | Live hands vs. a rule-based bot; every decision EV-graded |
| **Exploit Lab** | `/exploit` | Scout → Diagnose → Exploit matches vs. a mystery bot with a hidden leak |
| **Analytics** | `/analytics` | Mastery trajectories over the observation log, remediation flags, hand review |
| **Instructor console** | `/admin/*` | Cohort KPIs, roster, item analysis, learning curves, health, CSV export (staff only) |

Six tracked skills: `preflop_range`, `equity_estimation`, `pot_odds`, `implied_odds`,
`mdf`, `opponent_reading`.

---

## Quick start

### Backend

```bash
cd backend && cp .env.example .env && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver
```

> **Run it from `backend/`.** The default `DATABASE_URL=sqlite:///db.sqlite3` is
> **cwd-relative** — launching from the repo root silently creates an empty database
> elsewhere and every request fails with `no such table: users_user`.

### Frontend

```bash
cd frontend && npm install && npm run dev
```

Vite serves on `:5173` and proxies `/api` → `localhost:8000`, so no CORS setup is needed
for local dev.

### Tests

```bash
cd backend && python -m pytest
```

```bash
cd frontend && npm test
```

---

## Configuration

**`backend/.env`** (see `backend/.env.example`)

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Required when `DEBUG=False` — boot fails without it |
| `DEBUG` | `True` locally; permissive defaults exist only under it |
| `DATABASE_URL` | Blank → SQLite. Set a `postgres://` URL for production |
| `ALLOWED_HOSTS` | Required when `DEBUG=False` — boot fails without it |
| `CORS_ALLOWED_ORIGINS` | Comma-separated; not needed when using the Vite proxy |
| `ANTHROPIC_API_KEY` | Reserved for the LLM tutor (not yet implemented) |
| `STAFF_USERNAMES` | Comma-separated accounts `manage.py promote_staff` grants instructor access |

**`frontend/.env`** — `VITE_API_BASE_URL=/api` (the dev-proxy path).

### Granting instructor access

The console is gated on Django's `User.is_staff`. Accounts are created through the app's
own signup page, then promoted — no password ever goes into an environment variable:

```bash
python manage.py promote_staff alice bob
```

With no arguments it reads `STAFF_USERNAMES`, which makes it safe to chain into a deploy
step (`migrate && promote_staff`). It is idempotent, and an unknown username warns rather
than failing the deploy; pass `--strict` to make the mismatch an error.

---

## Layout

```
backend/
  config/                 settings, root urlconf, WSGI
  apps/
    users/                custom user, JWT auth, promote_staff command
    student_model/        BKT engine, StudentProfile, SkillObservation log, grading funnel
    poker_engine/         dealer, bot, hand/EV evaluation, scenarios, Exploit Lab
    admin_analytics/      instructor dashboard API (read-only, staff-gated)
    llm_tutor/            stubbed — Module 5, not yet implemented
frontend/src/
  pages/                  one file per route (+ pages/admin/ for the console)
  components/             PokerTable, quiz/replay modals, learn/, exploit/, admin/, analytics/
  lessons/                curriculum metadata, lazy-loaded lesson bodies, and math.js
  services/api.js         Axios client + JWT refresh-rotation interceptor
```

### Invariants worth knowing before you change anything

1. **Decisions are graded, outcomes are not.** Win/loss never reaches BKT.
2. **Grading is server-side only.** Answer keys and villain cards do not reach the client
   before grading.
3. **One mastery write path.** Quiz, practice, live-hand, and Exploit Lab observations all
   funnel through `student_model.services.record_skill_observation`.
4. **Everything is reproducible.** Generated scenarios, live hands, and Exploit Lab
   matches all reconstruct from a stored id or seed.
5. **Lessons cannot contradict the graders.** Every number in the Learning Center is
   computed through `frontend/src/lessons/math.js`, a pure mirror of `ev_eval.py` /
   `generators.py` pinned to backend-emitted values by `math.test.js`.
6. **Exploit Lab hands are excluded from Arena aggregates** (`match__isnull=True`) and are
   not GTO-graded — grading them would punish the exploitative deviations that mode teaches.

---

## Documentation

| File | What it is |
|------|-----------|
| [project.md](project.md) | The specification and module roadmap — design decisions and their rationale |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Current build status, API surface, test state, known issues |
| [EXPLOIT_LAB_PLAN.md](EXPLOIT_LAB_PLAN.md) | Exploit Lab work order (implemented) |
| [GAMEPLAY_QUIZ_INTEGRATION.md](GAMEPLAY_QUIZ_INTEGRATION.md) | Hand-replay quiz work order (implemented) |
| [backend/README.md](backend/README.md), [frontend/README.md](frontend/README.md) | Per-package setup and conventions |

---

## Deployment notes

- `gunicorn` serves the WSGI app; `whitenoise` serves collected static files from the web
  process, so no separate static host or CDN is required.
- With `DEBUG=False` the app **refuses to boot** without a real `SECRET_KEY` and
  `ALLOWED_HOSTS`. This is deliberate — a misconfigured production instance should fail
  loudly rather than run with development defaults.
- Deploy step: `python manage.py migrate && python manage.py collectstatic --noinput &&
  python manage.py promote_staff`.
