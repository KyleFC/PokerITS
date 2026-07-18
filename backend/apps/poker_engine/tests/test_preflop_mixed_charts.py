"""Tests for the mixed-frequency (advanced tier) preflop charts."""
import pytest

from apps.poker_engine import preflop_charts as pc
from apps.poker_engine import preflop_mixed_charts as pmc

RFI_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN']


class TestDataIntegrity:
    def test_all_hands_are_valid_grid_classes(self):
        valid = set(pc.ALL_HAND_CLASSES)
        for chart in pmc.RFI_MIXED.values():
            assert set(chart) <= valid
        assert set(pmc.SB_MIXED) <= valid

    @pytest.mark.parametrize('position', RFI_POSITIONS)
    def test_rfi_frequencies_are_meaningful(self, position):
        for klass, freq in pmc.RFI_MIXED[position].items():
            # A listed hand must actually raise sometimes; pure folds are
            # encoded by omission.
            assert 0 < freq <= 1, (position, klass, freq)

    def test_sb_frequencies_form_a_distribution(self):
        for klass, (raise_f, call_f) in pmc.SB_MIXED.items():
            assert 0 <= raise_f <= 1 and 0 <= call_f <= 1, klass
            assert raise_f + call_f <= 1 + 1e-9, klass
            assert raise_f + call_f > 0, klass  # pure folds are omitted

    def test_mixed_strategy_always_sums_to_one(self):
        for position in RFI_POSITIONS + ['SB']:
            for klass in pc.ALL_HAND_CLASSES:
                mix = pmc.mixed_strategy(position, klass)
                assert set(mix) == {'allin', 'raise', 'call', 'fold'}
                assert sum(mix.values()) == pytest.approx(1.0), (position, klass)
                assert all(f >= 0 for f in mix.values()), (position, klass)


class TestTierConsistency:
    """The binary simple tier must be exactly the rounded mixed tier."""

    @pytest.mark.parametrize('position', RFI_POSITIONS)
    def test_rfi_ranges_are_majority_raise_hands(self, position):
        for klass in pc.ALL_HAND_CLASSES:
            expected = pmc.RFI_MIXED[position].get(klass, 0.0) >= 0.5
            assert pc.is_in_opening_range(position, klass) == expected, klass

    def test_sb_simple_matches_majority_action(self):
        for klass in pc.ALL_HAND_CLASSES:
            action = pmc.simple_action('SB', klass)
            assert (klass in pc.SB_SIMPLE['raise']) == (action == 'raise'), klass
            assert (klass in pc.SB_SIMPLE['call']) == (action == 'call'), klass

    def test_sb_simple_actions_are_disjoint(self):
        assert not (pc.SB_SIMPLE['raise'] & pc.SB_SIMPLE['call'])


class TestChartShape:
    """Sanity-check the retuned charts against the source sims' headline
    numbers (GTO Wizard 6-max NL25: UTG ~17.5% raise, BTN ~45%)."""

    def test_mixed_rfi_fractions_are_plausible_and_increasing(self):
        def combo_weighted(position):
            total = 0.0
            for klass, freq in pmc.RFI_MIXED[position].items():
                combos = 6 if len(klass) == 2 else 4 if klass[2] == 's' else 12
                total += combos * freq
            return total / 1326

        fractions = [combo_weighted(p) for p in RFI_POSITIONS]
        assert fractions == sorted(fractions), fractions
        assert 0.14 < fractions[0] < 0.22, fractions   # UTG ~17.5%
        assert 0.40 < fractions[-1] < 0.50, fractions  # BTN ~45%

    def test_sb_plays_most_hands(self):
        # The SB gets a discount and closes the limp branch: the sim plays
        # (raises or limps) the large majority of hands.
        assert pc.sb_vpip_fraction() > 0.60

    def test_premium_hands_never_mixed_below_certainty(self):
        for position in RFI_POSITIONS:
            for klass in ('AA', 'KK', 'QQ', 'AKs', 'AKo'):
                assert pmc.RFI_MIXED[position][klass] == 1.0, (position, klass)
