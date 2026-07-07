from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from apps.student_model.models import StudentProfile, DEFAULT_SKILLS
from apps.student_model.observations import SkillObservation
from apps.student_model.serializers import StudentProfileSerializer, QuizResultSerializer, SkillObservationSerializer
from apps.student_model.bkt_engine import update_mastery, DEFAULT_PARAMS
from apps.poker_engine.scenario_bank import get_scenario_by_id
from apps.poker_engine import generators

class StudentProfileView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = StudentProfileSerializer

    def get_object(self):
        profile, created = StudentProfile.objects.get_or_create(user=self.request.user)
        return profile

class QuizResultView(APIView):
    """Grade a quiz answer server-side and record the BKT observation.

    The client submits only ``{scenario_id, answer}``. The scenario's skill
    and correct answer are resolved from the server-side scenario bank — the
    client's opinion of correctness is never trusted, since the entire student
    model (and every downstream module that reads it) depends on this being an
    honest evaluation of the decision, not a self-reported score.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        serializer = QuizResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scenario_id = serializer.validated_data['scenario_id']
        answer = serializer.validated_data['answer']

        scenario = get_scenario_by_id(scenario_id)
        if scenario is None:
            return Response(
                {"detail": f"Scenario not found: {scenario_id}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        skill = scenario.get('skill')
        params = DEFAULT_PARAMS.get(skill)
        if not params:
            return Response(
                {"detail": f"Scenario {scenario_id} has an invalid skill: {skill}"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # Grade the answer against the server-side answer key.
        correct = answer == scenario.get('correct_answer')

        with transaction.atomic():
            profile, _ = StudentProfile.objects.get_or_create(user=request.user)

            prior = profile.skills.get(skill, DEFAULT_SKILLS[skill])
            posterior = round(update_mastery(prior, correct, params), 4)

            profile.skills[skill] = posterior
            profile.save()

            SkillObservation.objects.create(
                user=request.user,
                skill=skill,
                correct=correct,
                posterior_after=posterior,
                # Distinguish authored diagnostics from infinite-mode drills so
                # analytics can tell the two apart; the id still fully identifies
                # (and can regenerate) the exact question either way.
                source='infinite' if generators.is_generated_id(scenario_id) else 'quiz',
                reference_id=scenario_id,
            )

        return Response(
            {
                'correct': correct,
                'correct_answer': scenario.get('correct_answer'),
                'explanation': scenario.get('explanation'),
                'ev_notes': scenario.get('ev_notes'),
                'skill': skill,
                'profile': StudentProfileSerializer(profile).data,
            },
            status=status.HTTP_201_CREATED,
        )

class SkillHistoryView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = SkillObservationSerializer

    def get_queryset(self):
        queryset = SkillObservation.objects.filter(user=self.request.user)
        skill = self.request.query_params.get('skill')
        if skill:
            queryset = queryset.filter(skill=skill)
        return queryset
