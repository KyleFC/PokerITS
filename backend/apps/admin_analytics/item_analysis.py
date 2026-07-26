"""Classical item analysis over the quiz observation log.

Every graded answer records the id of the question that produced it
(``SkillObservation.reference_id``), which makes it possible to ask the two
questions that matter about a question bank:

**p-value** — what fraction of attempts were correct. Near 1.0 the item teaches
nothing (everyone already knows it); near the guess rate it is either too hard
or badly worded.

**Discrimination** — do students who do well *overall* also do well on this
item? Computed as the Pearson correlation, across students, between their score
on this item and their accuracy on every *other* observation they have (the item
itself is excluded from the comparison so a heavily-attempted item can't
correlate with itself). Positive is healthy. **Negative discrimination is the
signature of a miskeyed answer**: the students who understand the material are
systematically marked wrong, which no amount of manual re-reading of the bank
reliably catches.

Grouping: authored bank items group by their exact id. Generated items
(``gen:<skill>:<version>:<seed>``, see ``poker_engine.generators``) are grouped
into one row per *generator family* — each seed is essentially unique, so
per-seed rows would all have n=1 and say nothing, while the family tells you
whether a generator as a whole is producing fair questions.

Live-hand and Exploit Lab observations are excluded: their ``reference_id`` is a
hand or match id, not a reusable question, so there is no item to analyse.
"""
import math

from django.db.models import Count, Q

from apps.poker_engine import generators
from apps.poker_engine.scenario_bank import load_scenarios
from apps.student_model.models import SKILL_CHOICES
from apps.student_model.observations import SkillObservation

SKILL_LABELS = dict(SKILL_CHOICES)

# Sources whose reference_id identifies a reusable question.
ITEM_SOURCES = ('quiz', 'infinite')

# Below this many attempts the statistics are noise; rows are still returned
# (you want to see that an item is untried) but flagged rather than judged.
MIN_ATTEMPTS = 10
# Discrimination needs students, not attempts — one student answering 50 times
# gives a correlation of nothing.
MIN_STUDENTS = 5

TOO_EASY_P = 0.95
TOO_HARD_P = 0.25
MISKEY_D = -0.15
WEAK_D = 0.05


def _family_id(reference_id: str) -> str:
    """Collapse a generated id to its generator family, leave others alone."""
    if generators.is_generated_id(reference_id):
        parts = reference_id.split(':')
        if len(parts) == 4:
            return ':'.join(parts[:3])  # gen:<skill>:<version>
    return reference_id


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    """Pearson correlation, or None when it is undefined (no variance)."""
    n = len(xs)
    if n < 2:
        return None
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    dx = [x - mean_x for x in xs]
    dy = [y - mean_y for y in ys]
    denom = math.sqrt(sum(d * d for d in dx) * sum(d * d for d in dy))
    if denom == 0:
        return None
    return sum(a * b for a, b in zip(dx, dy)) / denom


def _flags(p_value, discrimination, attempts, students) -> list[str]:
    flags = []
    if attempts < MIN_ATTEMPTS:
        flags.append('insufficient_data')
        return flags
    if p_value >= TOO_EASY_P:
        flags.append('too_easy')
    if p_value <= TOO_HARD_P:
        flags.append('too_hard')
    if discrimination is not None and students >= MIN_STUDENTS:
        if discrimination < MISKEY_D:
            flags.append('possible_miskey')
        elif discrimination < WEAK_D:
            flags.append('low_discrimination')
    return flags


def _bank_index() -> dict:
    """``{scenario_id: scenario}`` for the authored bank."""
    return {s['id']: s for s in load_scenarios() if s.get('id')}


def item_analysis(min_attempts: int = 1) -> list[dict]:
    """Per-item statistics, hardest-to-defend items first.

    Two queries: one grouped by (item, user) for the per-item scores, one
    grouped by user for the overall accuracy each item is compared against.
    """
    # Per (reference_id, user) scores.
    rows = (
        SkillObservation.objects
        .filter(source__in=ITEM_SOURCES)
        .exclude(reference_id='')
        .values('reference_id', 'user_id', 'skill')
        .annotate(n=Count('id'), n_correct=Count('id', filter=Q(correct=True)))
    )

    # Each user's totals across *all* item-sourced observations, used to build
    # the "accuracy on everything else" baseline per item.
    user_totals = {
        r['user_id']: (r['n'], r['n_correct'])
        for r in SkillObservation.objects
        .filter(source__in=ITEM_SOURCES)
        .values('user_id')
        .annotate(n=Count('id'), n_correct=Count('id', filter=Q(correct=True)))
    }

    items = {}
    for r in rows:
        key = _family_id(r['reference_id'])
        item = items.setdefault(key, {
            'item_id': key,
            'skill': r['skill'],
            'generated': generators.is_generated_id(key),
            'attempts': 0,
            'correct': 0,
            'per_user': [],  # (item_score, rest_accuracy)
        })
        item['attempts'] += r['n']
        item['correct'] += r['n_correct']

        total_n, total_correct = user_totals.get(r['user_id'], (0, 0))
        rest_n = total_n - r['n']
        rest_correct = total_correct - r['n_correct']
        # A student whose only answers are on this item has no "everything else"
        # to correlate against; they contribute to p-value but not discrimination.
        if rest_n > 0:
            item['per_user'].append((r['n_correct'] / r['n'], rest_correct / rest_n))

    bank = _bank_index()

    results = []
    for item in items.values():
        attempts = item['attempts']
        p_value = item['correct'] / attempts if attempts else 0.0
        pairs = item['per_user']
        discrimination = _pearson([a for a, _ in pairs], [b for _, b in pairs])
        students = len(pairs)

        scenario = bank.get(item['item_id'])
        if item['generated']:
            parts = item['item_id'].split(':')
            title = f"Generated: {SKILL_LABELS.get(item['skill'], item['skill'])}"
            subtitle = f"generator {parts[2]}" if len(parts) >= 3 else ''
        else:
            title = (scenario or {}).get('title') or item['item_id']
            subtitle = (scenario or {}).get('question') or ''

        results.append({
            'item_id': item['item_id'],
            'title': title,
            'subtitle': subtitle,
            'skill': item['skill'],
            'skill_label': SKILL_LABELS.get(item['skill'], item['skill']),
            'generated': item['generated'],
            # An authored id with no matching bank entry means the bank changed
            # after students answered it — worth surfacing, not hiding.
            'orphaned': not item['generated'] and scenario is None,
            'attempts': attempts,
            'correct': item['correct'],
            'p_value': round(p_value, 4),
            'students': students,
            'discrimination': (
                round(discrimination, 4) if discrimination is not None else None
            ),
            'correct_answer': (scenario or {}).get('correct_answer'),
            'flags': _flags(p_value, discrimination, attempts, students),
        })

    results = [r for r in results if r['attempts'] >= min_attempts]
    # Most-actionable first: miskey suspects, then other flagged items, then by
    # volume so the items shaping the most students' mastery rise to the top.
    results.sort(key=lambda r: (
        0 if 'possible_miskey' in r['flags'] else 1,
        0 if r['flags'] and 'insufficient_data' not in r['flags'] else 1,
        -r['attempts'],
    ))
    return results


def unattempted_items() -> list[dict]:
    """Authored bank items nobody has answered yet.

    Coverage gaps are invisible in the item table (an item with no observations
    produces no rows), but they are exactly what you want to know before
    claiming the bank is exercised.
    """
    attempted = set(
        SkillObservation.objects
        .filter(source='quiz').exclude(reference_id='')
        .values_list('reference_id', flat=True).distinct()
    )
    return [
        {
            'item_id': s['id'],
            'title': s.get('title') or s['id'],
            'skill': s.get('skill'),
            'skill_label': SKILL_LABELS.get(s.get('skill'), s.get('skill')),
        }
        for s in load_scenarios()
        if s.get('id') and s['id'] not in attempted
    ]
