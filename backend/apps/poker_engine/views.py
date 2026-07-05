from rest_framework import views, status, permissions
from rest_framework.response import Response
from apps.poker_engine.serializers import PublicScenarioSerializer
from apps.poker_engine.scenario_bank import load_scenarios, get_scenario_by_id

class ScenarioListView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        scenarios = load_scenarios()
        skill = request.query_params.get('skill')
        if skill:
            scenarios = [s for s in scenarios if s.get('skill') == skill]

        serializer = PublicScenarioSerializer(scenarios, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ScenarioDetailView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PublicScenarioSerializer(scenario)
        return Response(serializer.data, status=status.HTTP_200_OK)
