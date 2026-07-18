from django.db.models import Count

from rest_framework import serializers
from apps.student_model.models import StudentProfile
from apps.student_model.observations import SkillObservation

class StudentProfileSerializer(serializers.ModelSerializer):
    # Per-skill observation counts, so a client can apply the same mastery gate
    # the server uses (bkt_engine.is_mastered): a skill is mastered only with a
    # high posterior AND enough evidence. Without the count the UI would call a
    # lucky 3-answer spike "mastered".
    skill_observations = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ('id', 'skills', 'skill_observations', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_skill_observations(self, obj):
        counts = (
            SkillObservation.objects
            .filter(user=obj.user)
            .values('skill')
            .annotate(n=Count('id'))
        )
        return {row['skill']: row['n'] for row in counts}

class QuizResultSerializer(serializers.Serializer):
    """Input for grading a quiz answer. The scenario's skill and answer key
    are resolved server-side from ``scenario_id`` — never supplied by the client."""
    scenario_id = serializers.CharField(max_length=50)
    answer = serializers.CharField()

class SkillObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillObservation
        fields = ('id', 'skill', 'timestamp', 'correct', 'posterior_after', 'source', 'reference_id')
        read_only_fields = ('id', 'timestamp', 'posterior_after')
