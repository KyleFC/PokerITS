import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.student_model.models import StudentProfile, DEFAULT_SKILLS
from apps.student_model.observations import SkillObservation
from apps.poker_engine import generators

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


@pytest.mark.django_db
class TestGeneratedScenarioGrading:
    """Infinite-mode scenarios are graded through the same server-side path:
    the grader regenerates the scenario from the seed in its id, so the client
    never needs (and never receives) the answer key up front."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('quiz_result')
        self.user = User.objects.create_user(username='infinite', password='Passw0rd!xyz')
        self.client.force_authenticate(user=self.user)

    def test_generated_correct_answer_grades_and_updates_bkt(self):
        scenario = generators.generate('pot_odds', 4242)
        response = self.client.post(
            self.url,
            {'scenario_id': scenario['id'], 'answer': scenario['correct_answer']},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['correct'] is True
        assert response.data['skill'] == 'pot_odds'
        assert response.data['profile']['skills']['pot_odds'] > DEFAULT_SKILLS['pot_odds']

    def test_generated_wrong_answer_lowers_mastery(self):
        scenario = generators.generate('mdf', 7)
        wrong = next(o for o in scenario['options'] if o != scenario['correct_answer'])
        response = self.client.post(self.url, {'scenario_id': scenario['id'], 'answer': wrong})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['correct'] is False
        assert response.data['profile']['skills']['mdf'] < DEFAULT_SKILLS['mdf']

    def test_generated_observation_tagged_infinite_with_reference_id(self):
        scenario = generators.generate('pot_odds', 99)
        self.client.post(
            self.url,
            {'scenario_id': scenario['id'], 'answer': scenario['correct_answer']},
        )
        obs = SkillObservation.objects.get(user=self.user)
        assert obs.source == 'infinite'
        assert obs.reference_id == scenario['id']

    def test_malformed_generated_id_returns_404(self):
        response = self.client.post(
            self.url,
            {'scenario_id': 'gen:pot_odds:v1:notaseed', 'answer': '25%'},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestGenerateEndpoint:
    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('scenario_generate')

    def test_generates_requested_skill_without_leaking_answer(self):
        resp = self.client.get(self.url, {'skill': 'pot_odds'})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['skill'] == 'pot_odds'
        assert resp.data['id'].startswith('gen:pot_odds:')
        assert 'correct_answer' not in resp.data
        assert 'explanation' not in resp.data
        assert len(resp.data['options']) == 4

    def test_no_internal_fields_leak_for_any_skill(self):
        # Generators may carry internal keys (e.g. 'meta' with out counts or
        # range membership) that would hint at the answer — the public
        # serializer must strip them for every generatable skill.
        for skill in generators.GENERATORS:
            resp = self.client.get(self.url, {'skill': skill})
            assert resp.status_code == status.HTTP_200_OK
            assert 'meta' not in resp.data, skill
            assert 'correct_answer' not in resp.data, skill
            assert 'explanation' not in resp.data, skill
            assert 'ev_notes' not in resp.data, skill

    def test_unknown_skill_is_rejected(self):
        resp = self.client.get(self.url, {'skill': 'not_a_skill'})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_no_skill_param_still_returns_a_generatable_scenario(self):
        resp = self.client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['skill'] in generators.GENERATORS

    def test_targets_weakest_skill_for_authenticated_student(self):
        user = User.objects.create_user(username='weakspot', password='Passw0rd!xyz')
        profile, _ = StudentProfile.objects.get_or_create(user=user)
        # Make one generatable skill overwhelmingly the weakest; the weighted
        # draw should land on it the vast majority of the time.
        profile.skills = {**profile.skills, 'pot_odds': 0.01, 'mdf': 0.99}
        profile.save()
        self.client.force_authenticate(user=user)

        picks = [self.client.get(self.url).data['skill'] for _ in range(30)]
        assert picks.count('pot_odds') > picks.count('mdf')
