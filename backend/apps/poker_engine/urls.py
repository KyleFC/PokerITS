from django.urls import path
from apps.poker_engine.views import (
    ScenarioListView,
    ScenarioDetailView,
    ScenarioReplayView,
    GenerateScenarioView,
    LiveHandStartView,
    LiveHandActionView,
    PreflopRangesView,
    HandHistoryListView,
    HandStatsView,
)
from apps.poker_engine.exploit_views import (
    ExploitMatchCreateView,
    ExploitMatchDetailView,
    ExploitMatchDealView,
    ExploitDiagnosisView,
)

urlpatterns = [
    path('scenarios/', ScenarioListView.as_view(), name='scenario_list'),
    # "generate/" must precede the catch-all detail route so it is not parsed
    # as a scenario id.
    path('scenarios/generate/', GenerateScenarioView.as_view(), name='scenario_generate'),
    # The replay route must precede the catch-all detail route so that
    # ".../<id>/replay/" is not swallowed by "<scenario_id>/".
    path('scenarios/<str:scenario_id>/replay/', ScenarioReplayView.as_view(), name='scenario_replay'),
    path('scenarios/<str:scenario_id>/', ScenarioDetailView.as_view(), name='scenario_detail'),

    # Static preflop charts, expanded for the range-viewer page.
    path('ranges/', PreflopRangesView.as_view(), name='preflop_ranges'),

    # Live heads-up play vs the rule-based bot (Module 3).
    path('hands/', LiveHandStartView.as_view(), name='live_hand_start'),
    # Completed-hand analytics (Module 4 / Arena stats). Static segments must
    # precede the <uuid:hand_id> route, though the uuid converter would reject
    # them anyway.
    path('hands/history/', HandHistoryListView.as_view(), name='hand_history_list'),
    path('hands/stats/', HandStatsView.as_view(), name='hand_stats'),
    path('hands/<uuid:hand_id>/action/', LiveHandActionView.as_view(), name='live_hand_action'),

    # Exploit Lab (Module 5) — heads-up 'diagnose the opponent' matches.
    path('exploit/matches/', ExploitMatchCreateView.as_view(), name='exploit_match_create'),
    path('exploit/matches/<uuid:match_id>/', ExploitMatchDetailView.as_view(), name='exploit_match_detail'),
    path('exploit/matches/<uuid:match_id>/hands/', ExploitMatchDealView.as_view(), name='exploit_match_deal'),
    path('exploit/matches/<uuid:match_id>/diagnosis/', ExploitDiagnosisView.as_view(), name='exploit_diagnosis'),
]
