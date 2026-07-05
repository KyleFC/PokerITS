from rest_framework import serializers
from apps.student_model.models import StudentProfile
from apps.student_model.observations import SkillObservation

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ('id', 'skills', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

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
