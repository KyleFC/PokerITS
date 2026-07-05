from rest_framework import serializers
from apps.poker_engine.models import HandHistory

class PublicScenarioSerializer(serializers.Serializer):
    """Scenario as served to the client for display.

    Deliberately omits ``correct_answer``, ``explanation`` and ``ev_notes``:
    the answer key must not reach the browser before the answer is graded
    server-side. Those fields are returned only in the grading response
    (see ``student_model`` quiz-result endpoint).
    """
    id = serializers.CharField(max_length=50)
    skill = serializers.CharField(max_length=50)
    title = serializers.CharField(max_length=100)
    description = serializers.CharField()
    hole_cards = serializers.ListField(child=serializers.CharField(max_length=2))
    board = serializers.ListField(child=serializers.CharField(max_length=2), required=False, default=list)
    position = serializers.CharField(max_length=5, required=False, allow_null=True)
    pot_size_bb = serializers.FloatField(required=False, default=1.5)
    stack_size_bb = serializers.FloatField(required=False, default=100)
    villain_action = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    question = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())

class HandHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = HandHistory
        fields = '__all__'
        read_only_fields = ('id', 'timestamp')
