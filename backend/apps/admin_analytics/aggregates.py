"""Cohort-level aggregation for the instructor dashboard.

Query discipline
----------------
Every function here issues a **constant number of queries** regardless of how
many students exist. The tempting shape — loop the users, query per user — is an
N+1 that turns a 40-student class into 200 queries; and the other tempting shape
— one ``annotate()`` with several joins — silently multiplies counts through the
join (a user with 10 observations and 3 hands reports 30 of each). So each
source table is grouped separately with ``values(...).annotate(...)`` and the
rows are stitched together by user id in Python.

Roster size assumption: the roster loads every user and merges in memory, which
is right for a classroom cohort (tens to low hundreds) and keeps sorting on
computed columns like accuracy possible. If this ever serves thousands of users,
the roster needs DB-level pagination *before* the merge, and sorting restricted
to real columns.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum, Max, Min
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.poker_engine.models import HandHistory, LiveHand, ExploitMatch
from apps.student_model.bkt_engine import (
    DEFAULT_PARAMS, MASTERY_THRESHOLD, is_mastered,
)
from apps.student_model.models import StudentProfile, SKILL_CHOICES
from apps.student_model.observations import SkillObservation

User = get_user_model()

SKILLS = [key for key, _ in SKILL_CHOICES]
SKILL_LABELS = dict(SKILL_CHOICES)

# Mastery histogram buckets. Six bins over [0, 1]; the top bin is closed so a
# posterior of exactly 1.0 lands in it rather than falling off the end.
MASTERY_BINS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 0.95), (0.95, 1.01)]
MASTERY_BIN_LABELS = ['0-20%', '20-40%', '40-60%', '60-80%', '80-95%', '95%+']


def _bin_index(value: float) -> int:
    for i, (lo, hi) in enumerate(MASTERY_BINS):
        if lo <= value < hi:
            return i
    return len(MASTERY_BINS) - 1


def _ratio(numerator: int, denominator: int, places: int = 4) -> float:
    return round(numerator / denominator, places) if denominator else 0.0


# --------------------------------------------------------------------------- #
# per-source grouped queries (each is one query)
# --------------------------------------------------------------------------- #
def _observation_rollup(user_ids=None) -> dict:
    """``{user_id: {n, n_correct, first, last}}`` from one grouped query."""
    qs = SkillObservation.objects.all()
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    rows = qs.values('user_id').annotate(
        n=Count('id'),
        n_correct=Count('id', filter=Q(correct=True)),
        first=Min('timestamp'),
        last=Max('timestamp'),
    )
    return {r['user_id']: r for r in rows}


def _observation_by_skill(user_ids=None) -> dict:
    """``{user_id: {skill: {n, n_correct}}}`` from one grouped query."""
    qs = SkillObservation.objects.all()
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    rows = qs.values('user_id', 'skill').annotate(
        n=Count('id'),
        n_correct=Count('id', filter=Q(correct=True)),
    )
    out = {}
    for r in rows:
        out.setdefault(r['user_id'], {})[r['skill']] = {
            'n': r['n'], 'n_correct': r['n_correct'],
        }
    return out


def _hand_rollup(user_ids=None) -> dict:
    """``{user_id: {n, wins, net_bb, last}}`` over Arena hands only.

    Exploit Lab hands are excluded for the same reason the student's own stats
    page excludes them: their opponent is a jittered mystery profile, so folding
    them into bb/100 would compare results against an opponent that never
    existed as a stable archetype.
    """
    qs = HandHistory.objects.filter(match__isnull=True)
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    rows = qs.values('user_id').annotate(
        n=Count('id'),
        wins=Count('id', filter=Q(outcome='win')),
        net_bb=Sum('net_bb'),
        last=Max('timestamp'),
    )
    return {r['user_id']: r for r in rows}


def _match_rollup(user_ids=None) -> dict:
    """``{user_id: {n, complete, last}}`` over Exploit Lab matches."""
    qs = ExploitMatch.objects.all()
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    rows = qs.values('user_id').annotate(
        n=Count('id'),
        complete=Count('id', filter=Q(phase='complete')),
        last=Max('updated_at'),
    )
    return {r['user_id']: r for r in rows}


def _profile_rollup(user_ids=None) -> dict:
    """``{user_id: {skills, updated_at}}`` from StudentProfile."""
    qs = StudentProfile.objects.all()
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    return {
        r['user_id']: r
        for r in qs.values('user_id', 'skills', 'updated_at')
    }


def _latest(*values):
    """Latest non-None datetime among the arguments, or None."""
    present = [v for v in values if v is not None]
    return max(present) if present else None


# --------------------------------------------------------------------------- #
# roster
# --------------------------------------------------------------------------- #
def user_roster() -> list[dict]:
    """One row per user with activity rollups, ready to sort and paginate.

    Six queries total, independent of cohort size.
    """
    users = list(
        User.objects.all().values(
            'id', 'username', 'email', 'date_joined', 'last_login', 'is_staff',
        )
    )
    ids = [u['id'] for u in users]

    obs = _observation_rollup(ids)
    obs_by_skill = _observation_by_skill(ids)
    hands = _hand_rollup(ids)
    matches = _match_rollup(ids)
    profiles = _profile_rollup(ids)

    roster = []
    for u in users:
        uid = u['id']
        o = obs.get(uid, {})
        h = hands.get(uid, {})
        m = matches.get(uid, {})
        p = profiles.get(uid, {})
        skills = p.get('skills') or {}
        per_skill = obs_by_skill.get(uid, {})

        n_obs = o.get('n', 0)
        n_correct = o.get('n_correct', 0)
        n_hands = h.get('n', 0)
        net_bb = float(h.get('net_bb') or 0.0)

        mastered = sum(
            1 for s in SKILLS
            if is_mastered(skills.get(s, 0.0), per_skill.get(s, {}).get('n', 0))
        )

        roster.append({
            'id': uid,
            'username': u['username'],
            'email': u['email'],
            'is_staff': u['is_staff'],
            'date_joined': u['date_joined'],
            'last_login': u['last_login'],
            # "Last active" means last thing they actually did in the ITS —
            # last_login alone would call a student who logged in and bounced
            # more active than one mid-session on a refreshed token.
            'last_activity': _latest(o.get('last'), h.get('last'), m.get('last')),
            'first_activity': o.get('first'),
            'observations': n_obs,
            'observations_correct': n_correct,
            'accuracy': _ratio(n_correct, n_obs),
            'skills': {s: round(skills.get(s, 0.0), 4) for s in SKILLS},
            'skill_observations': {s: per_skill.get(s, {}).get('n', 0) for s in SKILLS},
            'skills_mastered': mastered,
            'mean_mastery': (
                round(sum(skills.get(s, 0.0) for s in SKILLS) / len(SKILLS), 4)
                if SKILLS else 0.0
            ),
            'hands_played': n_hands,
            'hands_won': h.get('wins', 0),
            'net_bb': round(net_bb, 2),
            'bb_per_100': round(net_bb / n_hands * 100, 2) if n_hands else 0.0,
            'matches': m.get('n', 0),
            'matches_complete': m.get('complete', 0),
        })

    return roster


# --------------------------------------------------------------------------- #
# cohort overview
# --------------------------------------------------------------------------- #
def _activity_timeline(days: int = 30) -> list[dict]:
    """Daily observation and hand counts for the last ``days`` days.

    Days with no activity are emitted as zeros so the chart shows gaps as gaps
    rather than compressing them away.
    """
    since = timezone.now() - timedelta(days=days)

    obs_rows = (
        SkillObservation.objects.filter(timestamp__gte=since)
        .annotate(day=TruncDate('timestamp')).values('day')
        .annotate(n=Count('id'), n_correct=Count('id', filter=Q(correct=True)))
    )
    hand_rows = (
        HandHistory.objects.filter(timestamp__gte=since)
        .annotate(day=TruncDate('timestamp')).values('day')
        .annotate(n=Count('id'))
    )
    obs_by_day = {r['day']: r for r in obs_rows}
    hands_by_day = {r['day']: r['n'] for r in hand_rows}

    today = timezone.now().date()
    timeline = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        o = obs_by_day.get(day, {})
        timeline.append({
            'date': day.isoformat(),
            'observations': o.get('n', 0),
            'observations_correct': o.get('n_correct', 0),
            'hands': hands_by_day.get(day, 0),
        })
    return timeline


def _skill_breakdown(profiles: list[dict]) -> list[dict]:
    """Per-skill cohort mastery distribution and answer accuracy.

    Two queries (per-skill observation counts, per-skill mastery comes from the
    already-fetched profiles).
    """
    obs_rows = (
        SkillObservation.objects.values('skill')
        .annotate(
            n=Count('id'),
            n_correct=Count('id', filter=Q(correct=True)),
            students=Count('user_id', distinct=True),
        )
    )
    obs_by_skill = {r['skill']: r for r in obs_rows}

    per_user_skill_counts = {}
    for r in (SkillObservation.objects.values('user_id', 'skill')
              .annotate(n=Count('id'))):
        per_user_skill_counts.setdefault(r['user_id'], {})[r['skill']] = r['n']

    breakdown = []
    for skill in SKILLS:
        masteries = []
        mastered = 0
        for p in profiles:
            value = (p.get('skills') or {}).get(skill)
            if value is None:
                continue
            masteries.append(value)
            n_obs = per_user_skill_counts.get(p['user_id'], {}).get(skill, 0)
            if is_mastered(value, n_obs):
                mastered += 1

        histogram = [0] * len(MASTERY_BINS)
        for value in masteries:
            histogram[_bin_index(value)] += 1

        o = obs_by_skill.get(skill, {})
        params = DEFAULT_PARAMS.get(skill)
        breakdown.append({
            'skill': skill,
            'label': SKILL_LABELS.get(skill, skill),
            'students_with_profile': len(masteries),
            'mean_mastery': round(sum(masteries) / len(masteries), 4) if masteries else 0.0,
            'median_mastery': (
                round(sorted(masteries)[len(masteries) // 2], 4) if masteries else 0.0
            ),
            'mastered_students': mastered,
            'histogram': histogram,
            'histogram_labels': MASTERY_BIN_LABELS,
            'observations': o.get('n', 0),
            'observations_correct': o.get('n_correct', 0),
            'accuracy': _ratio(o.get('n_correct', 0), o.get('n', 0)),
            'students_attempted': o.get('students', 0),
            # The BKT priors in force. Surfaced next to the observed accuracy so
            # a miscalibrated guess rate is visible: if a skill's observed
            # accuracy sits at the guess parameter, the model is learning
            # nothing from it.
            'params': {
                'p_l0': params.p_l0, 'p_t': params.p_t,
                'p_g': params.p_g, 'p_s': params.p_s,
            } if params else None,
        })
    return breakdown


def cohort_overview(activity_days: int = 30) -> dict:
    """Headline KPIs for the dashboard landing page."""
    now = timezone.now()
    day_7 = now - timedelta(days=7)
    day_30 = now - timedelta(days=30)

    total_users = User.objects.count()
    staff_users = User.objects.filter(is_staff=True).count()
    new_7d = User.objects.filter(date_joined__gte=day_7).count()

    # Active = produced an observation or played a hand, not merely logged in.
    active_ids_7d = set(
        SkillObservation.objects.filter(timestamp__gte=day_7)
        .values_list('user_id', flat=True).distinct()
    ) | set(
        HandHistory.objects.filter(timestamp__gte=day_7)
        .values_list('user_id', flat=True).distinct()
    )
    active_ids_30d = set(
        SkillObservation.objects.filter(timestamp__gte=day_30)
        .values_list('user_id', flat=True).distinct()
    ) | set(
        HandHistory.objects.filter(timestamp__gte=day_30)
        .values_list('user_id', flat=True).distinct()
    )

    obs_total = SkillObservation.objects.count()
    obs_correct = SkillObservation.objects.filter(correct=True).count()
    by_source = {
        r['source']: {'n': r['n'], 'n_correct': r['n_correct'],
                      'accuracy': _ratio(r['n_correct'], r['n'])}
        for r in SkillObservation.objects.values('source').annotate(
            n=Count('id'), n_correct=Count('id', filter=Q(correct=True)),
        )
    }

    arena_hands = HandHistory.objects.filter(match__isnull=True).count()
    lab_hands = HandHistory.objects.filter(match__isnull=False).count()
    matches_total = ExploitMatch.objects.count()
    matches_complete = ExploitMatch.objects.filter(phase='complete').count()

    profiles = list(StudentProfile.objects.values('user_id', 'skills'))

    # Students who have answered at least one question — the honest denominator
    # for "how is the cohort doing", since a registered account that never
    # started would otherwise drag every cohort average toward the priors.
    engaged = len(
        set(SkillObservation.objects.values_list('user_id', flat=True).distinct())
    )

    return {
        'generated_at': now.isoformat(),
        'users': {
            'total': total_users,
            'staff': staff_users,
            'engaged': engaged,
            'new_7d': new_7d,
            'active_7d': len(active_ids_7d),
            'active_30d': len(active_ids_30d),
        },
        'observations': {
            'total': obs_total,
            'correct': obs_correct,
            'accuracy': _ratio(obs_correct, obs_total),
            'by_source': by_source,
        },
        'play': {
            'arena_hands': arena_hands,
            'lab_hands': lab_hands,
            'matches': matches_total,
            'matches_complete': matches_complete,
            'match_completion_rate': _ratio(matches_complete, matches_total),
        },
        'skills': _skill_breakdown(profiles),
        'activity': _activity_timeline(activity_days),
        'mastery_threshold': MASTERY_THRESHOLD,
    }


# --------------------------------------------------------------------------- #
# learning curves
# --------------------------------------------------------------------------- #
def learning_curves(max_opportunity: int = 25) -> list[dict]:
    """Cohort accuracy as a function of attempt number, per skill.

    The central "is the tutor working?" chart: for each skill, accuracy on every
    student's 1st attempt, 2nd attempt, and so on. A curve that climbs is
    learning; a flat curve means the skill is not being taught (or the BKT
    priors in ``DEFAULT_PARAMS`` are miscalibrated and mastery is drifting up on
    the transition parameter rather than on evidence).

    ``n`` shrinks as the opportunity index rises — only students who attempted a
    skill 10 times contribute to point 10 — so it is returned per point and the
    UI should thin out low-``n`` tails rather than reading them as signal.

    One query; the per-student sequence is reconstructed in timestamp order.
    """
    rows = (
        SkillObservation.objects
        .order_by('user_id', 'skill', 'timestamp')
        .values_list('user_id', 'skill', 'correct')
    )

    # {skill: {opportunity_index: [n_attempts, n_correct]}}
    buckets = {s: {} for s in SKILLS}
    counters = {}
    for user_id, skill, correct in rows.iterator():
        if skill not in buckets:
            continue
        key = (user_id, skill)
        index = counters.get(key, 0) + 1
        counters[key] = index
        if index > max_opportunity:
            continue
        slot = buckets[skill].setdefault(index, [0, 0])
        slot[0] += 1
        slot[1] += 1 if correct else 0

    curves = []
    for skill in SKILLS:
        points = [
            {
                'opportunity': i,
                'n': buckets[skill][i][0],
                'correct': buckets[skill][i][1],
                'accuracy': _ratio(buckets[skill][i][1], buckets[skill][i][0]),
            }
            for i in sorted(buckets[skill])
        ]
        params = DEFAULT_PARAMS.get(skill)
        curves.append({
            'skill': skill,
            'label': SKILL_LABELS.get(skill, skill),
            'points': points,
            # Reference lines: the guess rate is the floor a non-master should
            # hover at, and 1 - slip is the ceiling a master should approach.
            'guess_rate': params.p_g if params else None,
            'ceiling': round(1 - params.p_s, 4) if params else None,
        })
    return curves


# --------------------------------------------------------------------------- #
# per-user drill-down
# --------------------------------------------------------------------------- #
def user_detail(user) -> dict:
    """Everything the drill-down page needs for one student."""
    per_skill = _observation_by_skill([user.id]).get(user.id, {})
    profile = StudentProfile.objects.filter(user=user).values('skills', 'updated_at').first()
    skills = (profile or {}).get('skills') or {}

    by_source = {
        r['source']: {'n': r['n'], 'n_correct': r['n_correct'],
                      'accuracy': _ratio(r['n_correct'], r['n'])}
        for r in SkillObservation.objects.filter(user=user).values('source').annotate(
            n=Count('id'), n_correct=Count('id', filter=Q(correct=True)),
        )
    }

    skill_rows = []
    for skill in SKILLS:
        counts = per_skill.get(skill, {'n': 0, 'n_correct': 0})
        mastery = skills.get(skill, 0.0)
        params = DEFAULT_PARAMS.get(skill)
        skill_rows.append({
            'skill': skill,
            'label': SKILL_LABELS.get(skill, skill),
            'mastery': round(mastery, 4),
            'observations': counts['n'],
            'correct': counts['n_correct'],
            'accuracy': _ratio(counts['n_correct'], counts['n']),
            'mastered': is_mastered(mastery, counts['n']),
            'prior': params.p_l0 if params else None,
        })

    matches = list(
        ExploitMatch.objects.filter(user=user)
        .values('id', 'difficulty', 'phase', 'created_at', 'updated_at',
                'diagnosis', 'scores')
        .order_by('-updated_at')[:20]
    )
    for m in matches:
        m['id'] = str(m['id'])
        diagnosis = m.pop('diagnosis') or {}
        m['read_correct'] = diagnosis.get('read_correct')
        m['adjustment_correct'] = diagnosis.get('adjustment_correct')

    return {
        'skills': skill_rows,
        'by_source': by_source,
        'profile_updated_at': (profile or {}).get('updated_at'),
        'matches': matches,
        'open_live_hands': LiveHand.objects.filter(user=user, complete=False).count(),
    }
