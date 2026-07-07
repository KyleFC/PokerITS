import secrets

from rest_framework import views, status, permissions
from rest_framework.response import Response
from apps.poker_engine.serializers import PublicScenarioSerializer
from apps.poker_engine.scenario_bank import load_scenarios, get_scenario_by_id
from apps.poker_engine.replay import build_replay, ReplayError
from apps.poker_engine import generators

# Seeds are drawn from this range and embedded in the scenario id. 2**31 keeps
# the id short (well under SkillObservation.reference_id's 50-char limit) while
# giving a practically unbounded stream of distinct questions per skill.
_SEED_SPACE = 2 ** 31

class ScenarioListView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        scenarios = load_scenarios()
        skill = request.query_params.get('skill')
        if skill:
            scenarios = [s for s in scenarios if s.get('skill') == skill]

        serializer = PublicScenarioSerializer(scenarios, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class GenerateScenarioView(views.APIView):
    """Serve one freshly generated scenario for infinite practice mode.

    ``GET /poker/scenarios/generate/?skill=<skill>`` returns a public
    (answer-key-stripped) scenario whose id encodes the seed that produced it,
    so the same server-side grader (which regenerates from that id) can score
    the eventual answer. Nothing is persisted.

    With no ``skill`` param the endpoint targets practice where it helps most:
    for an authenticated student it samples a skill weighted toward the ones
    with the lowest BKT mastery; otherwise it picks uniformly at random. Only
    skills that actually have a generator are ever chosen.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        skill = request.query_params.get('skill')
        if skill and skill not in generators.GENERATORS:
            return Response(
                {
                    "detail": f"No generator for skill: {skill}",
                    "available_skills": sorted(generators.GENERATORS),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not skill:
            skill = self._pick_skill(request)

        scenario = generators.generate(skill, secrets.randbelow(_SEED_SPACE))
        return Response(PublicScenarioSerializer(scenario).data, status=status.HTTP_200_OK)

    def _pick_skill(self, request):
        """Choose which skill to drill, biased toward the student's weak spots.

        Imported lazily so poker_engine has no import-time dependency on
        student_model (which already imports poker_engine's scenario bank —
        keeping the reverse dependency lazy avoids a circular import).
        """
        import random

        available = sorted(generators.GENERATORS)
        user = request.user
        if user and user.is_authenticated:
            from apps.student_model.models import StudentProfile

            profile = StudentProfile.objects.filter(user=user).first()
            skills = profile.skills if profile else {}
            # Weight each generatable skill by how far it is from mastery, with a
            # small floor so mastered skills still resurface occasionally.
            weights = [max(0.05, 1.0 - skills.get(s, 0.0)) for s in available]
            if any(w > 0 for w in weights):
                return random.choices(available, weights=weights, k=1)[0]
        return random.choice(available)


class ScenarioDetailView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PublicScenarioSerializer(scenario)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ScenarioReplayView(views.APIView):
    """Return the scripted hand replay (display frames) for a scenario.

    Runs the scenario's ``gameplay`` script through the poker engine server-side
    and returns the resulting frames plus the public (answer-key-stripped)
    scenario. The ``gameplay`` block itself — villain scripting and any exact
    villain cards — is never serialized to the client; only the frame snapshots
    (which reveal only the hero's cards) are sent. Same permissive access policy
    as the scenario list, since nothing here leaks the answer.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)
        if not scenario.get('gameplay'):
            return Response(
                {"detail": "Scenario has no gameplay script."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            replay = build_replay(scenario)
        except ReplayError as exc:
            # A malformed script is a scenario-authoring bug, not a client error.
            return Response(
                {"detail": f"Scenario replay could not be built: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        replay['scenario'] = PublicScenarioSerializer(scenario).data
        return Response(replay, status=status.HTTP_200_OK)
