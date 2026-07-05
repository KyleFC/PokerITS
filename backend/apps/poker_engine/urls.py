from django.urls import path
from apps.poker_engine.views import ScenarioListView, ScenarioDetailView

urlpatterns = [
    path('scenarios/', ScenarioListView.as_view(), name='scenario_list'),
    path('scenarios/<str:scenario_id>/', ScenarioDetailView.as_view(), name='scenario_detail'),
]
