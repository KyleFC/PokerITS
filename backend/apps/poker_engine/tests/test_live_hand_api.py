"""Integration tests for the live heads-up hand API (Module 3)."""
import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.poker_engine.models import LiveHand, HandHistory
from apps.student_model.observations import SkillObservation

User = get_user_model()


@pytest.mark.django_db
class TestLiveHandAPI:
    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.start_url = reverse('live_hand_start')
        self.user = User.objects.create_user(username='player', password='Passw0rd!xyz')
        self.client.force_authenticate(user=self.user)

    def _action_url(self, hand_id):
        return reverse('live_hand_action', kwargs={'hand_id': hand_id})

    def _passive(self, frame):
        types = {a['type'] for a in frame.get('legal_actions', [])}
        if 'check' in types:
            return {'type': 'check'}
        if 'call' in types:
            return {'type': 'call'}
        return {'type': 'fold'}

    # --------------------------------------------------------------- #
    def test_start_deals_a_hand_and_persists_it(self):
        response = self.client.post(self.start_url, {'profile': 'balanced'})
        assert response.status_code == status.HTTP_201_CREATED
        assert 'hand_id' in response.data
        frame = response.data['frame']
        assert frame['kind'] == 'decision'
        assert len(frame['hero_cards']) == 2
        assert LiveHand.objects.filter(id=response.data['hand_id']).exists()

    def test_start_rejects_unknown_profile(self):
        response = self.client.post(self.start_url, {'profile': 'godmode'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'available_profiles' in response.data

    def test_requires_authentication(self):
        anon = APIClient()
        assert anon.post(self.start_url).status_code == status.HTTP_401_UNAUTHORIZED

    def test_action_advances_and_grades_into_bkt(self):
        hand_id = self.client.post(self.start_url).data['hand_id']
        response = self.client.post(self._action_url(hand_id), {'type': 'call'})
        assert response.status_code == status.HTTP_200_OK
        # The preflop open decision is graded and logged as a hand observation.
        obs = response.data['observation']
        assert obs['skill'] == 'preflop_range'
        assert SkillObservation.objects.filter(user=self.user, source='hand').count() == 1
        assert response.data['profile']['skills']['preflop_range'] is not None

    def test_illegal_action_is_rejected(self):
        hand_id = self.client.post(self.start_url).data['hand_id']
        # Cannot check when facing the big blind as the button.
        response = self.client.post(self._action_url(hand_id), {'type': 'check'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'legal_actions' in response.data

    def test_raise_outside_bounds_is_rejected(self):
        hand_id = self.client.post(self.start_url).data['hand_id']
        response = self.client.post(
            self._action_url(hand_id), {'type': 'raise_to', 'amount_bb': 99999}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_playing_to_completion_writes_hand_history(self):
        hand_id = self.client.post(self.start_url, {'profile': 'nit'}).data['hand_id']
        complete = False
        guard = 0
        last_frame = None
        while not complete and guard < 60:
            guard += 1
            # Fetch current legal actions by driving from the last frame.
            row = LiveHand.objects.get(id=hand_id)
            from apps.poker_engine.game_loop import HeadsUpHand
            frame = HeadsUpHand.restore(row.state).current_frame()
            response = self.client.post(self._action_url(hand_id), self._passive(frame))
            assert response.status_code == status.HTTP_200_OK
            complete = response.data['complete']
            last_frame = response.data['frame']
        assert complete
        assert LiveHand.objects.get(id=hand_id).complete is True
        hh = HandHistory.objects.get(id=hand_id)
        assert hh.user == self.user
        assert hh.outcome in ('win', 'loss', 'tie')
        assert len(hh.hole_cards) == 2
        # Session-stats fields captured at completion.
        assert hh.bot_profile == 'nit'
        assert hh.net_bb is not None
        assert float(hh.net_bb) == pytest.approx(last_frame['result']['hero_net_bb'])

    def test_cannot_act_on_a_completed_hand(self):
        hand_id = self.client.post(self.start_url).data['hand_id']
        # Fold immediately to complete the hand.
        self.client.post(self._action_url(hand_id), {'type': 'fold'})
        response = self.client.post(self._action_url(hand_id), {'type': 'fold'})
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_cannot_act_on_another_users_hand(self):
        hand_id = self.client.post(self.start_url).data['hand_id']
        other = APIClient()
        intruder = User.objects.create_user(username='intruder', password='Passw0rd!xyz')
        other.force_authenticate(user=intruder)
        response = other.post(self._action_url(hand_id), {'type': 'call'})
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestHandStatsAPI:
    """Aggregated session stats + hand-review list (Arena stats / Module 4)."""

    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.start_url = reverse('live_hand_start')
        self.stats_url = reverse('hand_stats')
        self.history_url = reverse('hand_history_list')
        self.user = User.objects.create_user(username='grinder', password='Passw0rd!xyz')
        self.client.force_authenticate(user=self.user)

    def _fold_a_hand(self, profile='balanced'):
        """Deal and immediately fold: deterministic -0.5 BB loss, no showdown."""
        hand_id = self.client.post(self.start_url, {'profile': profile}).data['hand_id']
        url = reverse('live_hand_action', kwargs={'hand_id': hand_id})
        response = self.client.post(url, {'type': 'fold'})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['complete'] is True
        return hand_id

    def test_stats_require_authentication(self):
        anon = APIClient()
        assert anon.get(self.stats_url).status_code == status.HTTP_401_UNAUTHORIZED
        assert anon.get(self.history_url).status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_stats(self):
        response = self.client.get(self.stats_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['hands_played'] == 0
        assert response.data['net_bb_total'] == 0
        assert response.data['bb_per_100'] == 0
        assert response.data['timeline'] == []
        assert response.data['by_profile'] == {}

    def test_stats_aggregate_completed_hands(self):
        self._fold_a_hand(profile='balanced')
        self._fold_a_hand(profile='nit')
        response = self.client.get(self.stats_url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        # Folding the button loses exactly the posted 0.5 BB small blind.
        assert data['hands_played'] == 2
        assert data['net_bb_total'] == pytest.approx(-1.0)
        assert data['bb_per_100'] == pytest.approx(-50.0)
        assert data['record'] == {'win': 0, 'loss': 2, 'tie': 0}
        # Folded hands never reach showdown.
        assert data['showdown'] == {'hands': 0, 'wins': 0}
        assert data['non_showdown'] == {'hands': 2, 'wins': 0}
        # One entry per completed hand, tagged with its bot profile.
        assert [t['bot_profile'] for t in data['timeline']] == ['balanced', 'nit']
        assert data['timeline'][-1]['cumulative_bb'] == pytest.approx(-1.0)
        assert set(data['by_profile']) == {'balanced', 'nit'}
        assert data['by_profile']['nit']['hands'] == 1
        # The preflop open decision was graded on both hands.
        assert data['preflop']['graded_hands'] == 2

    def test_stats_ev_loss_totals_match_hand_history(self):
        self._fold_a_hand()
        hh = HandHistory.objects.get(user=self.user)
        expected = (hh.preflop_chart_deviation or 0.0) + sum(
            hh.postflop_ev_loss_by_street.values()
        )
        data = self.client.get(self.stats_url).data
        assert data['ev_loss_total_bb'] == pytest.approx(expected)
        assert data['ev_loss_per_hand_bb'] == pytest.approx(expected, abs=1e-3)

    def test_history_list_is_paginated_and_scoped_to_user(self):
        mine = self._fold_a_hand()

        other_client = APIClient()
        other = User.objects.create_user(username='other', password='Passw0rd!xyz')
        other_client.force_authenticate(user=other)
        other_hand = other_client.post(self.start_url).data['hand_id']
        other_client.post(
            reverse('live_hand_action', kwargs={'hand_id': other_hand}),
            {'type': 'fold'},
        )

        response = self.client.get(self.history_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        row = response.data['results'][0]
        assert row['id'] == mine
        assert float(row['net_bb']) == pytest.approx(-0.5)
        assert row['bot_profile'] == 'balanced'

    def test_stats_ignore_other_users_hands(self):
        other_client = APIClient()
        other = User.objects.create_user(username='someone', password='Passw0rd!xyz')
        other_client.force_authenticate(user=other)
        hand_id = other_client.post(self.start_url).data['hand_id']
        other_client.post(
            reverse('live_hand_action', kwargs={'hand_id': hand_id}), {'type': 'fold'}
        )
        assert self.client.get(self.stats_url).data['hands_played'] == 0
