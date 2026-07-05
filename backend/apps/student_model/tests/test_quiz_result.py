import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.student_model.models import StudentProfile, DEFAULT_SKILLS
from apps.student_model.observations import SkillObservation

User = get_user_model()


@pytest.mark.django_db
class TestQuizResultGrading:
    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('quiz_result')
        self.user = User.objects.create_user(username='grader', password='Passw0rd!xyz')
        self.client.force_authenticate(user=self.user)

    def test_correct_answer_is_graded_and_raises_mastery(self):
        # preflop_01: correct answer is "Fold", skill preflop_range.
        response = self.client.post(self.url, {'scenario_id': 'preflop_01', 'answer': 'Fold'})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['correct'] is True
        assert response.data['skill'] == 'preflop_range'
        assert response.data['profile']['skills']['preflop_range'] > DEFAULT_SKILLS['preflop_range']

    def test_wrong_answer_is_graded_incorrect_and_lowers_mastery(self):
        response = self.client.post(self.url, {'scenario_id': 'preflop_01', 'answer': 'Raise to 2.5BB'})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['correct'] is False
        assert response.data['profile']['skills']['preflop_range'] < DEFAULT_SKILLS['preflop_range']

    def test_client_cannot_self_report_correctness(self):
        # Even if a client tries to inject a `correct` flag, grading is done
        # server-side purely from the submitted answer vs. the answer key.
        response = self.client.post(
            self.url,
            {'scenario_id': 'preflop_01', 'answer': 'Raise to 2.5BB', 'correct': True},
        )
        assert response.data['correct'] is False

    def test_observation_is_logged_with_reference_id(self):
        self.client.post(self.url, {'scenario_id': 'preflop_01', 'answer': 'Fold'})
        obs = SkillObservation.objects.filter(user=self.user)
        assert obs.count() == 1
        assert obs.first().reference_id == 'preflop_01'
        assert obs.first().source == 'quiz'

    def test_unknown_scenario_returns_404(self):
        response = self.client.post(self.url, {'scenario_id': 'does_not_exist', 'answer': 'Fold'})
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self):
        anon = APIClient()
        response = anon.post(self.url, {'scenario_id': 'preflop_01', 'answer': 'Fold'})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_scenario_list_does_not_leak_answer_key(self):
        # The public scenario endpoint must never expose the correct answer.
        resp = self.client.get(reverse('scenario_list'))
        assert resp.status_code == status.HTTP_200_OK
        for scenario in resp.data:
            assert 'correct_answer' not in scenario
            assert 'explanation' not in scenario
