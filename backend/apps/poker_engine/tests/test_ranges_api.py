"""Tests for the preflop-ranges display endpoint (both difficulty tiers)."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.poker_engine import preflop_charts, preflop_mixed_charts


@pytest.mark.django_db
class TestPreflopRangesAPI:
    @pytest.fixture(autouse=True)
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('preflop_ranges')

    def test_no_auth_required(self):
        assert self.client.get(self.url).status_code == status.HTTP_200_OK

    def test_six_max_simple_tier_matches_source_of_truth(self):
        data = self.client.get(self.url).data['six_max']
        assert data['open_raise_size_bb'] == preflop_charts.OPEN_RAISE_SIZE_BB
        by_code = {p['code']: p for p in data['positions']}
        assert list(by_code) == ['UTG', 'HJ', 'CO', 'BTN', 'SB']
        for code in ('UTG', 'HJ', 'CO', 'BTN'):
            pos = by_code[code]
            assert pos['actions'] == ['raise']
            assert set(pos['simple']['raise']) == preflop_charts.RFI_RANGES[code]
            assert pos['name'] == preflop_charts.POSITION_NAMES[code]
            assert pos['fraction'] == pytest.approx(
                preflop_charts.range_fraction(code), abs=1e-4
            )

    def test_six_max_sb_has_three_action_simple_chart(self):
        data = self.client.get(self.url).data['six_max']
        sb = next(p for p in data['positions'] if p['code'] == 'SB')
        assert sb['actions'] == ['raise', 'call']
        assert set(sb['simple']['raise']) == preflop_charts.SB_SIMPLE['raise']
        assert set(sb['simple']['call']) == preflop_charts.SB_SIMPLE['call']
        assert sb['open_raise_size_bb'] == preflop_mixed_charts.SB_OPEN_RAISE_SIZE_BB

    def test_mixed_tier_matches_source_and_is_sparse(self):
        data = self.client.get(self.url).data['six_max']
        for pos in data['positions']:
            source = (
                preflop_mixed_charts.SB_MIXED if pos['code'] == 'SB'
                else preflop_mixed_charts.RFI_MIXED[pos['code']]
            )
            assert set(pos['mixed']) == set(source)
            for klass, mix in pos['mixed'].items():
                truth = preflop_mixed_charts.mixed_strategy(pos['code'], klass)
                # Sparse: no fold entry, no zero-frequency actions.
                assert 'fold' not in mix
                assert all(f > 0 for f in mix.values())
                for action, freq in mix.items():
                    assert freq == pytest.approx(truth[action])

    def test_simple_tier_is_rounded_mixed_tier(self):
        data = self.client.get(self.url).data['six_max']
        for pos in data['positions']:
            for action, hands in pos['simple'].items():
                for klass in hands:
                    assert preflop_mixed_charts.simple_action(pos['code'], klass) == action

    def test_heads_up_charts_match_source_of_truth(self):
        data = self.client.get(self.url).data['heads_up']
        assert data['open_raise_size_bb'] == preflop_charts.HU_OPEN_RAISE_SIZE_BB
        by_code = {p['code']: p for p in data['positions']}
        assert list(by_code) == ['SB', 'BB']
        assert by_code['SB']['actions'] == ['raise']
        assert by_code['BB']['actions'] == ['defend']
        assert set(by_code['SB']['simple']['raise']) == preflop_charts.HU_RANGES['SB']
        assert set(by_code['BB']['simple']['defend']) == preflop_charts.HU_RANGES['BB']

    def test_hands_are_valid_grid_classes(self):
        response = self.client.get(self.url)
        valid = set(preflop_charts.ALL_HAND_CLASSES)
        for group in ('six_max', 'heads_up'):
            for pos in response.data[group]['positions']:
                for hands in pos['simple'].values():
                    assert set(hands) <= valid
                assert set(pos.get('mixed', {})) <= valid
