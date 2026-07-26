"""Instructor/researcher dashboard API.

Mounted at ``/api/admin/``. Every view is read-only and gated on
``User.is_staff`` — see ``permissions.IsStaffUser`` for why that check lives
here and not in the SPA.
"""
import csv
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, views
from rest_framework.response import Response

from apps.admin_analytics import aggregates, item_analysis
from apps.admin_analytics.permissions import IsStaffReadOnly
from apps.poker_engine.models import ExploitMatch, HandHistory, LiveHand
from apps.poker_engine.serializers import HandHistorySerializer
from apps.poker_engine.stats import hand_stats_for
from apps.student_model.observations import SkillObservation
from apps.student_model.serializers import SkillObservationSerializer

User = get_user_model()

# Sort keys the roster accepts, mapped to the row field they read. Whitelisted
# rather than passed through so a query param can never reach into arbitrary
# attributes.
ROSTER_SORTS = {
    'username': 'username',
    'joined': 'date_joined',
    'last_activity': 'last_activity',
    'observations': 'observations',
    'accuracy': 'accuracy',
    'mastery': 'mean_mastery',
    'mastered': 'skills_mastered',
    'hands': 'hands_played',
    'bb_per_100': 'bb_per_100',
}

MAX_PAGE_SIZE = 200


def _int_param(request, name, default, minimum=1, maximum=None):
    try:
        value = int(request.query_params.get(name, default))
    except (TypeError, ValueError):
        return default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


class AdminOverviewView(views.APIView):
    """``GET /api/admin/overview/`` — cohort KPIs, skill distributions, activity."""
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, *args, **kwargs):
        days = _int_param(request, 'days', 30, minimum=1, maximum=365)
        return Response(aggregates.cohort_overview(activity_days=days))


class AdminUserListView(views.APIView):
    """``GET /api/admin/users/`` — the student roster.

    Supports ``?q=`` (username/email substring), ``?sort=`` (see ROSTER_SORTS),
    ``?order=asc|desc``, ``?page=``, ``?page_size=``. Sorting happens after the
    rollups are merged, which is what makes computed columns like accuracy and
    bb/100 sortable at all.
    """
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, *args, **kwargs):
        roster = aggregates.user_roster()

        query = (request.query_params.get('q') or '').strip().lower()
        if query:
            roster = [
                r for r in roster
                if query in r['username'].lower() or query in (r['email'] or '').lower()
            ]

        if request.query_params.get('include_staff', 'true').lower() == 'false':
            roster = [r for r in roster if not r['is_staff']]

        sort_key = ROSTER_SORTS.get(request.query_params.get('sort'), 'last_activity')
        descending = request.query_params.get('order', 'desc').lower() != 'asc'
        # last_activity / last_login are None for users who never did anything.
        # The (is not None, value) key keeps them comparable — equal keys never
        # reach a None-vs-None comparison — and parks them at the low end, so
        # descending order puts real activity first.
        roster.sort(
            key=lambda r: (r[sort_key] is not None, r[sort_key]),
            reverse=descending,
        )

        page = _int_param(request, 'page', 1)
        page_size = _int_param(request, 'page_size', 50, maximum=MAX_PAGE_SIZE)
        start = (page - 1) * page_size

        return Response({
            'count': len(roster),
            'page': page,
            'page_size': page_size,
            'results': roster[start:start + page_size],
        })


class AdminUserDetailView(views.APIView):
    """``GET /api/admin/users/<id>/`` — full drill-down for one student.

    Deliberately mirrors the shapes the student's own Analytics and Arena Stats
    pages consume (``observations`` matches ``SkillObservationSerializer``,
    ``hand_stats`` matches ``/poker/hands/stats/``) so the admin UI can reuse
    those chart components verbatim instead of forking them.
    """
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, user_id, *args, **kwargs):
        user = get_object_or_404(User, pk=user_id)
        limit = _int_param(request, 'observations', 500, maximum=5000)
        hand_limit = _int_param(request, 'hands', 25, maximum=200)

        detail = aggregates.user_detail(user)

        # Newest-first from the DB (indexed), reversed to oldest-first because
        # that is the order a timeline chart plots.
        observations = list(
            SkillObservation.objects.filter(user=user)[:limit]
        )[::-1]

        recent_hands = (
            HandHistory.objects
            .filter(user=user, match__isnull=True)[:hand_limit]
        )

        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
                'is_active': user.is_active,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
            },
            'skills': detail['skills'],
            'by_source': detail['by_source'],
            'profile_updated_at': detail['profile_updated_at'],
            'matches': detail['matches'],
            'open_live_hands': detail['open_live_hands'],
            'observations': SkillObservationSerializer(observations, many=True).data,
            'hand_stats': hand_stats_for(user),
            'recent_hands': HandHistorySerializer(recent_hands, many=True).data,
        })


class AdminItemAnalysisView(views.APIView):
    """``GET /api/admin/items/`` — p-value / discrimination per quiz item."""
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, *args, **kwargs):
        min_attempts = _int_param(request, 'min_attempts', 1, minimum=1)
        return Response({
            'items': item_analysis.item_analysis(min_attempts=min_attempts),
            'unattempted': item_analysis.unattempted_items(),
            'thresholds': {
                'min_attempts': item_analysis.MIN_ATTEMPTS,
                'min_students': item_analysis.MIN_STUDENTS,
                'too_easy_p': item_analysis.TOO_EASY_P,
                'too_hard_p': item_analysis.TOO_HARD_P,
                'miskey_d': item_analysis.MISKEY_D,
                'weak_d': item_analysis.WEAK_D,
            },
        })


class AdminLearningCurvesView(views.APIView):
    """``GET /api/admin/curves/`` — cohort accuracy vs. attempt number per skill."""
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, *args, **kwargs):
        max_opportunity = _int_param(request, 'max_opportunity', 25, maximum=100)
        return Response({
            'curves': aggregates.learning_curves(max_opportunity=max_opportunity),
        })


class AdminHealthView(views.APIView):
    """``GET /api/admin/health/`` — abandoned sessions and data-integrity checks.

    Abandoned rows are a UX signal, not just housekeeping: a pile of live hands
    stuck at the same street, or matches abandoned in the diagnosis phase, marks
    the exact point where students give up.
    """
    permission_classes = (IsStaffReadOnly,)

    def get(self, request, *args, **kwargs):
        hours = _int_param(request, 'stale_hours', 24, minimum=1, maximum=24 * 30)
        cutoff = timezone.now() - timedelta(hours=hours)

        stale_hands = LiveHand.objects.filter(complete=False, updated_at__lt=cutoff)
        stale_matches = ExploitMatch.objects.exclude(phase='complete').filter(
            updated_at__lt=cutoff
        )

        abandoned_by_phase = {
            r['phase']: r['n']
            for r in stale_matches.values('phase').annotate(n=Count('id'))
        }

        return Response({
            'stale_hours': hours,
            'live_hands': {
                'open': LiveHand.objects.filter(complete=False).count(),
                'stale': stale_hands.count(),
                'oldest': (
                    stale_hands.order_by('updated_at')
                    .values_list('updated_at', flat=True).first()
                ),
            },
            'matches': {
                'incomplete': ExploitMatch.objects.exclude(phase='complete').count(),
                'stale': stale_matches.count(),
                'abandoned_by_phase': abandoned_by_phase,
            },
            'row_counts': {
                'users': User.objects.count(),
                'observations': SkillObservation.objects.count(),
                'hand_histories': HandHistory.objects.count(),
                'live_hands': LiveHand.objects.count(),
                'exploit_matches': ExploitMatch.objects.count(),
            },
            'integrity': {
                # Observations whose source should carry a question id but
                # doesn't — they still move mastery, but can never be traced
                # back to what was asked.
                'observations_without_reference': SkillObservation.objects.filter(
                    source__in=item_analysis.ITEM_SOURCES, reference_id='',
                ).count(),
                'hands_without_net_bb': HandHistory.objects.filter(
                    net_bb__isnull=True,
                ).count(),
            },
        })


class _Echo:
    """File-like object whose write() returns the line, for csv streaming."""

    def write(self, value):
        return value


class AdminExportView(views.APIView):
    """``GET /api/admin/export/?dataset=observations|hands|users`` — CSV download.

    Streamed rather than built in memory: the observation log is append-only and
    grows without bound, and a research export is exactly the request most
    likely to ask for all of it at once.
    """
    permission_classes = (IsStaffReadOnly,)

    DATASETS = ('observations', 'hands', 'users')

    def get(self, request, *args, **kwargs):
        dataset = request.query_params.get('dataset', 'observations')
        if dataset not in self.DATASETS:
            return Response(
                {'detail': f"Unknown dataset '{dataset}'. "
                           f"Choose one of: {', '.join(self.DATASETS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        writer = csv.writer(_Echo())
        rows = getattr(self, f'_{dataset}_rows')(writer)

        response = StreamingHttpResponse(rows, content_type='text/csv')
        stamp = timezone.now().strftime('%Y%m%d')
        response['Content-Disposition'] = (
            f'attachment; filename="poker_its_{dataset}_{stamp}.csv"'
        )
        return response

    def _observations_rows(self, writer):
        yield writer.writerow([
            'observation_id', 'user_id', 'username', 'skill', 'correct',
            'posterior_after', 'source', 'reference_id', 'timestamp',
        ])
        queryset = (
            SkillObservation.objects
            .select_related('user')
            .order_by('timestamp')
            .iterator(chunk_size=1000)
        )
        for obs in queryset:
            yield writer.writerow([
                obs.id, obs.user_id, obs.user.username, obs.skill,
                int(obs.correct), obs.posterior_after, obs.source,
                obs.reference_id, obs.timestamp.isoformat(),
            ])

    def _hands_rows(self, writer):
        yield writer.writerow([
            'hand_id', 'user_id', 'username', 'timestamp', 'bot_profile',
            'outcome', 'net_bb', 'pot_size', 'preflop_chart_deviation',
            'postflop_ev_loss', 'is_lab_hand',
        ])
        queryset = (
            HandHistory.objects
            .select_related('user')
            .order_by('timestamp')
            .iterator(chunk_size=1000)
        )
        for hand in queryset:
            postflop = sum((hand.postflop_ev_loss_by_street or {}).values())
            yield writer.writerow([
                hand.id, hand.user_id, hand.user.username,
                hand.timestamp.isoformat(), hand.bot_profile, hand.outcome,
                hand.net_bb if hand.net_bb is not None else '',
                hand.pot_size,
                hand.preflop_chart_deviation
                if hand.preflop_chart_deviation is not None else '',
                round(postflop, 4),
                int(hand.match_id is not None),
            ])

    def _users_rows(self, writer):
        roster = aggregates.user_roster()
        skills = aggregates.SKILLS
        yield writer.writerow(
            ['user_id', 'username', 'email', 'date_joined', 'last_activity',
             'observations', 'accuracy', 'hands_played', 'bb_per_100',
             'skills_mastered']
            + [f'mastery_{s}' for s in skills]
            + [f'observations_{s}' for s in skills]
        )
        for row in roster:
            yield writer.writerow(
                [
                    row['id'], row['username'], row['email'],
                    row['date_joined'].isoformat() if row['date_joined'] else '',
                    row['last_activity'].isoformat() if row['last_activity'] else '',
                    row['observations'], row['accuracy'], row['hands_played'],
                    row['bb_per_100'], row['skills_mastered'],
                ]
                + [row['skills'][s] for s in skills]
                + [row['skill_observations'][s] for s in skills]
            )
