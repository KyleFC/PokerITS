# Poker ITS — Backend

Django 5 + Django REST Framework. JWT auth, no WebSockets, no Celery — the bot acts inline
within the same request/response cycle as the player's action.

See the [root README](../README.md) for the project overview and
[project.md](../project.md) for the design rationale.

## Setup

```bash
cp .env.example .env && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver
```

> **Always run from this directory.** `DATABASE_URL=sqlite:///db.sqlite3` is cwd-relative —
> starting Django from the repo root creates a second, empty database and every request
> fails with `no such table: users_user`.

## Tests

```bash
python -m pytest
```

`pytest.ini` sets `--reuse-db`, so the first run pays for schema creation and later runs
don't. Add `--create-db` after a migration if the reused database goes stale.

## Apps

| App | Owns |
|-----|------|
| `users` | Custom `User`, register/me endpoints, `StudentProfile` auto-creation signal, `promote_staff` |
| `student_model` | `bkt_engine.py` (pure math), `StudentProfile`, `SkillObservation` log, `services.record_skill_observation` |
| `poker_engine` | Dealer, bot, hand/EV evaluation, scenario bank + generators, replay, Exploit Lab |
| `admin_analytics` | Instructor dashboard API — read-only aggregation over the other apps |
| `llm_tutor` | Stubbed. `client.py` / `prompts.py` are placeholders for Module 5 |

## Conventions

- **Pure modules stay pure.** `bkt_engine.py`, `ev_eval.py`, `hand_eval.py`, `replay.py`,
  `game_loop.py`, `exploit_profiles.py`, and `exploit_stats.py` contain no ORM calls and no
  I/O. That is what keeps them fast to test and safe to reason about.
- **One mastery write path.** Every BKT update goes through
  `student_model.services.record_skill_observation`. Do not update `StudentProfile.skills`
  directly.
- **Seeded RNG everywhere.** `Deck(seed)`, `random.Random(seed)` in generators, the game
  loop, and Exploit Lab jitter. Nothing that affects a graded outcome uses unseeded
  randomness.
- **Never leak the answer key.** The replay endpoint withholds correct answers and villain
  cards until after grading; Exploit Lab withholds the bot's identity and parameters until
  the match completes. New endpoints are expected to hold the same line.
- **Staff endpoints re-check authorization.** `admin_analytics.permissions.IsStaffReadOnly`
  decides on every request — the SPA's route guard is a UI convenience, not a control.

## Adding a tracked skill

Four places must agree, or the profile and the math silently diverge:

1. `student_model/bkt_engine.py` → `DEFAULT_PARAMS` (with a rationale comment)
2. `student_model/models.py` → `SKILL_CHOICES` (+ an `AlterField` migration)
3. `student_model/observations.py` → skill choices (same migration)
4. `frontend/src/constants.js` → `SKILL_LABELS` and `BKT_PARAMS_BY_SKILL`

`DEFAULT_SKILLS` derives a new student's starting mastery from `P(L0)` automatically, so
priors can't diverge from the engine.

## Production

`gunicorn` + `whitenoise`. With `DEBUG=False` the settings module raises
`ImproperlyConfigured` unless a real `SECRET_KEY` and `ALLOWED_HOSTS` are supplied — a
misconfigured instance fails loudly instead of serving with dev defaults.
