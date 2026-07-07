from django.urls import path
from apps.poker_engine.views import (
    ScenarioListView,
    ScenarioDetailView,
    ScenarioReplayView,
    GenerateScenarioView,
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
]
