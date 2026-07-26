"""Admin dashboard API: access control first, then aggregate correctness."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.admin_analytics import aggregates, item_analysis
from apps.poker_engine.models import ExploitMatch, HandHistory, LiveHand
from apps.student_model.observations import SkillObservation
from apps.student_model.services import record_skill_observation

User = get_user_model()

ADMIN_URLS = [
    reverse('admin_analytics:overview'),
    reverse('admin_analytics:user-list'),
    reverse('admin_analytics:item-analysis'),
    reverse('admin_analytics:learning-curves'),
    reverse('admin_analytics:health'),
    reverse('admin_analytics:export'),
]


@pytest.fixture
def student(db):
    return User.objects.create_user(username='student1', password='pw-student-1!')


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        username='instructor', password='pw-instructor-1!', is_staff=True,
    )


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# --------------------------------------------------------------------------- #
# access control
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('url', ADMIN_URLS)
def test_anonymous_is_rejected(url):
    assert APIClient().get(url).status_code == 401


@pytest.mark.parametrize('url', ADMIN_URLS)
def test_non_staff_is_forbidden(student, url):
    assert auth_client(student).get(url).status_code == 403


@pytest.mark.parametrize('url', ADMIN_URLS)
def test_staff_is_allowed(staff, url):
    assert auth_client(staff).get(url).status_code == 200


def test_non_staff_cannot_read_another_users_detail(student, staff):
    """The drill-down exposes another user's whole record — staff only."""
    url = reverse('admin_analytics:user-detail', args=[staff.id])
    assert auth_client(student).get(url).status_code == 403
    assert auth_client(staff).get(url).status_code == 200


@pytest.mark.parametrize('url', ADMIN_URLS)
def test_writes_are_rejected_even_for_staff(staff, url):
    """The dashboard is an analysis surface; it must not mutate the student model."""
    response = auth_client(staff).post(url, {}, format='json')
    assert response.status_code in (403, 405)


def test_is_staff_is_exposed_on_me(staff, student):
    """The SPA needs the flag to decide whether to render the admin route."""
    assert auth_client(staff).get('/api/auth/me/').data['is_staff'] is True
    assert auth_client(student).get('/api/auth/me/').data['is_staff'] is False


# --------------------------------------------------------------------------- #
# roster aggregates
# --------------------------------------------------------------------------- #
def test_roster_counts_are_not_inflated_by_joins(student, staff):
    """The classic multi-join bug: 3 observations x 2 hands must not read as 6.

    Guards the deliberate choice in aggregates.py to group each source table
    separately instead of chaining annotations across joins.
    """
    for correct in (True, True, False):
        record_skill_observation(
            user=student, skill='pot_odds', correct=correct,
            source='quiz', reference_id='pot_odds_01',
        )
    for _ in range(2):
        HandHistory.objects.create(
            user=student, hole_cards=['As', 'Kd'], net_bb=1.5,
            bot_profile='balanced', outcome='win',
        )

    row = next(r for r in aggregates.user_roster() if r['id'] == student.id)
    assert row['observations'] == 3
    assert row['observations_correct'] == 2
    assert row['accuracy'] == pytest.approx(2 / 3, abs=1e-4)
    assert row['hands_played'] == 2
    assert row['net_bb'] == pytest.approx(3.0)
    assert row['bb_per_100'] == pytest.approx(150.0)


def test_roster_excludes_lab_hands_from_arena_stats(student):
    """Exploit Lab hands must not pollute bb/100 — their opponent is jittered."""
    match = ExploitMatch.objects.create(
        user=student, difficulty='easy', base_profile='nit', bot_params={},
        seed=1, scout_target=5, exploit_target=5,
    )
    HandHistory.objects.create(
        user=student, hole_cards=['As', 'Kd'], net_bb=10, outcome='win',
    )
    HandHistory.objects.create(
        user=student, hole_cards=['2s', '7d'], net_bb=-50, outcome='loss',
        match=match,
    )

    row = next(r for r in aggregates.user_roster() if r['id'] == student.id)
    assert row['hands_played'] == 1
    assert row['net_bb'] == pytest.approx(10.0)


def test_roster_handles_users_with_no_activity(student):
    row = next(r for r in aggregates.user_roster() if r['id'] == student.id)
    assert row['observations'] == 0
    assert row['accuracy'] == 0.0
    assert row['last_activity'] is None
    assert row['skills_mastered'] == 0


def test_roster_sorting_tolerates_null_activity(staff, student):
    """Sorting on a nullable column must not raise on never-active users."""
    record_skill_observation(
        user=staff, skill='pot_odds', correct=True, source='quiz',
        reference_id='pot_odds_01',
    )
    response = auth_client(staff).get(
        reverse('admin_analytics:user-list'), {'sort': 'last_activity'},
    )
    assert response.status_code == 200
    # The active user sorts ahead of the one with no activity at all.
    assert response.data['results'][0]['id'] == staff.id


def test_roster_search_and_staff_filter(staff, student):
    url = reverse('admin_analytics:user-list')
    client = auth_client(staff)

    filtered = client.get(url, {'q': 'student'})
    assert [r['username'] for r in filtered.data['results']] == ['student1']

    no_staff = client.get(url, {'include_staff': 'false'})
    assert all(not r['is_staff'] for r in no_staff.data['results'])


# --------------------------------------------------------------------------- #
# overview
# --------------------------------------------------------------------------- #
def test_overview_reports_engaged_users_separately_from_registered(student, staff):
    record_skill_observation(
        user=student, skill='mdf', correct=True, source='quiz',
        reference_id='mdf_01',
    )
    data = aggregates.cohort_overview()
    assert data['users']['total'] == 2
    assert data['users']['engaged'] == 1
    assert data['observations']['total'] == 1
    assert data['observations']['accuracy'] == 1.0

    mdf = next(s for s in data['skills'] if s['skill'] == 'mdf')
    assert mdf['observations'] == 1
    assert mdf['students_attempted'] == 1
    assert sum(mdf['histogram']) == mdf['students_with_profile']


def test_activity_timeline_fills_empty_days(student):
    record_skill_observation(
        user=student, skill='mdf', correct=True, source='quiz',
        reference_id='mdf_01',
    )
    timeline = aggregates.cohort_overview(activity_days=7)['activity']
    assert len(timeline) == 7
    assert timeline[-1]['observations'] == 1
    assert all('date' in point for point in timeline)


# --------------------------------------------------------------------------- #
# learning curves
# --------------------------------------------------------------------------- #
def test_learning_curves_index_attempts_per_student(student, staff):
    """Opportunity N pools every student's Nth attempt at that skill."""
    for correct in (False, True, True):
        record_skill_observation(
            user=student, skill='pot_odds', correct=correct, source='quiz',
            reference_id='pot_odds_01',
        )
    record_skill_observation(
        user=staff, skill='pot_odds', correct=False, source='quiz',
        reference_id='pot_odds_01',
    )

    curve = next(c for c in aggregates.learning_curves() if c['skill'] == 'pot_odds')
    points = {p['opportunity']: p for p in curve['points']}
    # Two students each had a first attempt, both wrong.
    assert points[1]['n'] == 2
    assert points[1]['correct'] == 0
    # Only one student reached a third attempt.
    assert points[3]['n'] == 1
    assert points[3]['accuracy'] == 1.0


# --------------------------------------------------------------------------- #
# item analysis
# --------------------------------------------------------------------------- #
def _answer(user, item_id, correct, skill='pot_odds', source='quiz'):
    SkillObservation.objects.create(
        user=user, skill=skill, correct=correct, posterior_after=0.5,
        source=source, reference_id=item_id,
    )


def test_item_analysis_computes_p_value(student):
    for correct in (True, True, True, False):
        _answer(student, 'pot_odds_01', correct)

    row = next(
        r for r in item_analysis.item_analysis() if r['item_id'] == 'pot_odds_01'
    )
    assert row['attempts'] == 4
    assert row['correct'] == 3
    assert row['p_value'] == pytest.approx(0.75)


def test_item_analysis_flags_a_miskeyed_item(db):
    """Strong students marked wrong on one item is the miskey signature.

    Ten students: the five strong ones ace everything except this item, the five
    weak ones fail everything but get this item 'right'. The item's
    discrimination must come out negative and be flagged.
    """
    for i in range(5):
        strong = User.objects.create_user(username=f'strong{i}', password='pw-strong-1!')
        _answer(strong, 'suspect_item', False)
        for j in range(4):
            _answer(strong, f'ok_item_{j}', True)

        weak = User.objects.create_user(username=f'weak{i}', password='pw-weak-1!')
        _answer(weak, 'suspect_item', True)
        for j in range(4):
            _answer(weak, f'ok_item_{j}', False)

    rows = {r['item_id']: r for r in item_analysis.item_analysis()}
    suspect = rows['suspect_item']
    assert suspect['discrimination'] < 0
    assert 'possible_miskey' in suspect['flags']
    # And it sorts to the top, because that is the row an instructor must see.
    assert item_analysis.item_analysis()[0]['item_id'] == 'suspect_item'

    healthy = rows['ok_item_0']
    assert healthy['discrimination'] > 0
    assert 'possible_miskey' not in healthy['flags']


def test_generated_items_group_by_generator_family(student):
    """Per-seed rows would all be n=1; the family is the unit worth judging."""
    from apps.poker_engine import generators

    for seed in range(3):
        _answer(
            student, generators.build_scenario_id('pot_odds', seed),
            correct=True, source='infinite',
        )

    rows = {r['item_id']: r for r in item_analysis.item_analysis()}
    family = f'gen:pot_odds:{generators.VERSION}'
    assert family in rows
    assert rows[family]['attempts'] == 3
    assert rows[family]['generated'] is True


def test_item_analysis_ignores_hand_and_lab_observations(student):
    """A hand id is not a reusable question, so it is not an item."""
    _answer(student, 'some-hand-uuid', True, source='hand')
    _answer(student, 'pot_odds_01', True, source='quiz')

    ids = {r['item_id'] for r in item_analysis.item_analysis()}
    assert ids == {'pot_odds_01'}


def test_unattempted_items_surface_bank_coverage_gaps(student):
    _answer(student, 'preflop_01', True, skill='preflop_range')
    unattempted = {r['item_id'] for r in item_analysis.unattempted_items()}
    assert 'preflop_01' not in unattempted
    # The authored bank has more than one scenario, so something is left over.
    assert unattempted


def test_low_volume_items_are_flagged_not_judged(student):
    _answer(student, 'pot_odds_01', True)
    row = next(
        r for r in item_analysis.item_analysis() if r['item_id'] == 'pot_odds_01'
    )
    assert 'insufficient_data' in row['flags']
    assert 'too_easy' not in row['flags']


# --------------------------------------------------------------------------- #
# user detail
# --------------------------------------------------------------------------- #
def test_user_detail_matches_the_students_own_stats(student, staff):
    """The drill-down must agree with what the student sees on their own pages."""
    record_skill_observation(
        user=student, skill='pot_odds', correct=True, source='quiz',
        reference_id='pot_odds_01',
    )
    HandHistory.objects.create(
        user=student, hole_cards=['As', 'Kd'], net_bb=2.5,
        bot_profile='balanced', outcome='win',
    )

    admin_view = auth_client(staff).get(
        reverse('admin_analytics:user-detail', args=[student.id])
    ).data
    own_view = auth_client(student).get('/api/poker/hands/stats/').data

    assert admin_view['hand_stats'] == own_view
    assert admin_view['user']['username'] == 'student1'
    assert len(admin_view['observations']) == 1
    pot_odds = next(s for s in admin_view['skills'] if s['skill'] == 'pot_odds')
    assert pot_odds['observations'] == 1
    assert pot_odds['mastered'] is False  # one correct answer is not mastery


def test_user_detail_observations_are_oldest_first(student, staff):
    """The drill-down feeds a timeline chart, which plots oldest-first."""
    for skill in ('pot_odds', 'mdf', 'implied_odds'):
        record_skill_observation(
            user=student, skill=skill, correct=True, source='quiz',
            reference_id=f'{skill}_01',
        )

    data = auth_client(staff).get(
        reverse('admin_analytics:user-detail', args=[student.id])
    ).data
    timestamps = [o['timestamp'] for o in data['observations']]
    assert timestamps == sorted(timestamps)


def test_user_detail_404s_for_unknown_user(staff):
    url = reverse('admin_analytics:user-detail', args=[999999])
    assert auth_client(staff).get(url).status_code == 404


# --------------------------------------------------------------------------- #
# health + export
# --------------------------------------------------------------------------- #
def test_health_counts_open_and_stale_sessions(student, staff):
    from datetime import timedelta
    from django.utils import timezone

    fresh = LiveHand.objects.create(user=student, state={}, complete=False)
    stale = LiveHand.objects.create(user=student, state={}, complete=False)
    # auto_now blocks assignment through save(), so age the row via an update.
    LiveHand.objects.filter(pk=stale.pk).update(
        updated_at=timezone.now() - timedelta(hours=48)
    )

    data = auth_client(staff).get(reverse('admin_analytics:health')).data
    assert data['live_hands']['open'] == 2
    assert data['live_hands']['stale'] == 1
    assert data['row_counts']['live_hands'] == 2
    assert fresh.pk  # fresh hand is open but not stale


def test_export_streams_observation_csv(student, staff):
    record_skill_observation(
        user=student, skill='pot_odds', correct=True, source='quiz',
        reference_id='pot_odds_01',
    )
    response = auth_client(staff).get(
        reverse('admin_analytics:export'), {'dataset': 'observations'},
    )
    assert response.status_code == 200
    assert response['Content-Type'] == 'text/csv'
    assert 'attachment;' in response['Content-Disposition']

    body = b''.join(response.streaming_content).decode()
    lines = [line for line in body.splitlines() if line]
    assert lines[0].startswith('observation_id,user_id,username')
    assert 'student1' in lines[1]
    assert 'pot_odds_01' in lines[1]


def test_export_rejects_unknown_dataset(staff):
    response = auth_client(staff).get(
        reverse('admin_analytics:export'), {'dataset': 'everything'},
    )
    assert response.status_code == 400
