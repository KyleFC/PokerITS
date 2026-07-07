"""Scenario bank access layer.

Single source of truth for loading the static scenario bank from
``scenarios.json``. Both the poker_engine views (which serve scenarios to
the client) and the student_model views (which grade answers server-side)
read through here so the file is parsed in exactly one place.

Answer grading MUST happen on the server: ``correct_answer`` /
``explanation`` are never sent to the client before an answer is submitted
(see ``PublicScenarioSerializer``), and the client's claimed correctness is
never trusted (see ``student_model.views.QuizResultView``).
"""
import json
from pathlib import Path

from apps.poker_engine import generators

SCENARIOS_FILE = Path(__file__).resolve().parent / 'scenarios.json'


def load_scenarios() -> list[dict]:
    """Load and parse the full scenario bank. Returns [] on any read error."""
    if not SCENARIOS_FILE.exists():
        return []
    try:
        with open(SCENARIOS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def get_scenario_by_id(scenario_id: str) -> dict | None:
    """Return the full scenario dict (including answer key) for an id, or None.

    Handles both the static bank and procedurally generated scenarios: a
    ``gen:...`` id is rebuilt deterministically from the seed it encodes (see
    ``generators``) rather than looked up on disk. Routing generated ids through
    the same resolver means every existing caller — the detail/replay views and
    the server-side quiz grader — resolves and grades generated scenarios with
    no extra code path.
    """
    if generators.is_generated_id(scenario_id):
        return generators.generate_from_id(scenario_id)
    return next((s for s in load_scenarios() if s.get('id') == scenario_id), None)
