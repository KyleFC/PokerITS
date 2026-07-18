"""Tests for the static RFI charts backing the preflop_range generator."""
import pytest

from apps.poker_engine import preflop_charts as pc

POSITIONS = ['UTG', 'HJ', 'CO', 'BTN']


class TestHandClass:
    @pytest.mark.parametrize('c1,c2,expected', [
        ('As', 'Ks', 'AKs'),
        ('Kd', 'Ah', 'AKo'),
        ('7h', '7s', '77'),
        ('Ts', 'As', 'ATs'),   # order-independent, high card first
        ('2c', '9d', '92o'),
    ])
    def test_collapses_cards_to_class(self, c1, c2, expected):
        assert pc.hand_class(c1, c2) == expected


class TestRangeExpansion:
    def test_pair_plus(self):
        assert pc._expand('QQ+') == {'QQ', 'KK', 'AA'}

    def test_kicker_plus(self):
        assert pc._expand('AJs+') == {'AJs', 'AQs', 'AKs'}

    def test_connector_plus_preserves_gap(self):
        assert pc._expand('T9s+') == {'T9s', 'JTs', 'QJs', 'KQs', 'AKs'}

    def test_literal_token(self):
        assert pc._expand('QJo') == {'QJo'}


class TestChartSanity:
    @pytest.mark.parametrize('position', POSITIONS)
    def test_premiums_open_everywhere(self, position):
        for klass in ('AA', 'KK', 'QQ', 'AKs', 'AKo'):
            assert pc.is_in_opening_range(position, klass), (position, klass)

    @pytest.mark.parametrize('position', POSITIONS)
    def test_trash_opens_nowhere(self, position):
        for klass in ('72o', '32o', '82o', '93o'):
            assert not pc.is_in_opening_range(position, klass), (position, klass)

    def test_ranges_widen_toward_the_button(self):
        # Each later position must open a strict superset of the one before it.
        for tighter, wider in zip(POSITIONS, POSITIONS[1:]):
            assert pc.RFI_RANGES[tighter] < pc.RFI_RANGES[wider], (tighter, wider)

    def test_range_fractions_are_plausible_and_increasing(self):
        fractions = [pc.range_fraction(p) for p in POSITIONS]
        assert all(0.05 < f < 0.60 for f in fractions), fractions
        assert fractions == sorted(fractions)

    def test_all_hand_classes_is_the_full_grid(self):
        assert len(pc.ALL_HAND_CLASSES) == 169
        assert len(set(pc.ALL_HAND_CLASSES)) == 169


class TestBoundaryHands:
    """BOUNDARY_HANDS drives generator sampling — every entry must actually be
    on the side of the chart it claims, or generated answers would be wrong."""

    @pytest.mark.parametrize('position', POSITIONS)
    def test_boundary_in_hands_are_in_range(self, position):
        for klass in pc.BOUNDARY_HANDS[position]['in']:
            assert pc.is_in_opening_range(position, klass), (position, klass)

    @pytest.mark.parametrize('position', POSITIONS)
    def test_boundary_out_hands_are_out_of_range(self, position):
        for klass in pc.BOUNDARY_HANDS[position]['out']:
            assert not pc.is_in_opening_range(position, klass), (position, klass)


class TestHeadsUpCharts:
    """Heads-up SB/Button open and BB defend charts."""

    def test_sb_opens_wider_than_a_6max_button(self):
        # Heads-up the Button only has to get through one player, so its open is
        # strictly wider than the widest 6-max opening position.
        assert pc.RFI_RANGES['BTN'] < pc.HU_RANGES['SB']

    def test_premiums_are_in_both_charts(self):
        for klass in ('AA', 'KK', 'AKs', 'AKo', 'AQo'):
            assert pc.is_hu_open(klass), klass
            assert pc.is_hu_defend(klass), klass

    def test_worst_offsuit_is_in_neither_chart(self):
        for klass in ('32o', '42o', '52o', '72o'):
            assert not pc.is_hu_open(klass), klass
            assert not pc.is_hu_defend(klass), klass

    def test_all_pairs_and_suited_are_played(self):
        # Both heads-up charts continue every pair and every suited hand.
        for klass in pc.ALL_HAND_CLASSES:
            if len(klass) == 2 or klass[2] == 's':
                assert pc.is_hu_open(klass), klass
                assert pc.is_hu_defend(klass), klass

    def test_range_fractions_are_plausible(self):
        sb = pc.hu_range_fraction('SB')
        bb = pc.hu_range_fraction('BB')
        # SB opens very wide (~80%); BB defends wide but tighter than the open.
        assert 0.75 < sb < 0.90, sb
        assert 0.50 < bb < 0.70, bb
        assert bb < sb

    @pytest.mark.parametrize('role,check', [('SB', pc.is_hu_open), ('BB', pc.is_hu_defend)])
    def test_boundary_in_hands_are_in_range(self, role, check):
        for klass in pc.HU_BOUNDARY_HANDS[role]['in']:
            assert check(klass), (role, klass)

    @pytest.mark.parametrize('role,check', [('SB', pc.is_hu_open), ('BB', pc.is_hu_defend)])
    def test_boundary_out_hands_are_out_of_range(self, role, check):
        for klass in pc.HU_BOUNDARY_HANDS[role]['out']:
            assert not check(klass), (role, klass)
