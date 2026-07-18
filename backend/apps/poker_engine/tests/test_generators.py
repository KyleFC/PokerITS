"""Tests for the procedural scenario generators (infinite practice mode).

The core invariants that make server-side grading safe:
  * a generated id resolves to *exactly* the same scenario every time, so the
    answer the grader regenerates is the answer the student saw;
  * the correct answer is mathematically right for the numbers shown; and
  * every scenario is a well-formed 4-option multiple choice (the BKT guess
    parameter assumes 4 options).
"""
import re

import pytest

from apps.poker_engine import generators
from apps.poker_engine import preflop_charts
from apps.poker_engine.hand_eval import evaluate_hand

ALL_SKILLS = sorted(generators.GENERATORS)

_FULL_DECK = [r + s for r in '23456789TJQKA' for s in 'shdc']


def _bet_from(scenario):
    """Recover the villain bet B and pre-bet pot P from the displayed fields."""
    bet = float(re.search(r'([0-9.]+)BB', scenario['villain_action']).group(1))
    pot = scenario['pot_size_bb'] - bet
    return pot, bet


class TestIdEncoding:
    @pytest.mark.parametrize('skill', ALL_SKILLS)
    def test_id_round_trips(self, skill):
        sid = generators.build_scenario_id(skill, 42)
        assert generators.is_generated_id(sid)
        assert generators.parse_scenario_id(sid) == (skill, 42)

    def test_static_ids_are_not_generated(self):
        assert not generators.is_generated_id('preflop_01')
        assert generators.parse_scenario_id('preflop_01') is None

    @pytest.mark.parametrize('bad_id', [
        'gen:bogus_skill:v1:5',        # unknown skill
        'gen:pot_odds:v0:5',           # wrong version
        'gen:pot_odds:v1:notanumber',  # non-integer seed
        'gen:pot_odds:v1:-1',          # negative seed
        'gen:pot_odds:v1',             # too few segments
        'gen:pot_odds:v1:5:extra',     # too many segments
    ])
    def test_malformed_ids_resolve_to_none(self, bad_id):
        assert generators.parse_scenario_id(bad_id) is None
        assert generators.generate_from_id(bad_id) is None


class TestDeterminism:
    @pytest.mark.parametrize('skill', ALL_SKILLS)
    def test_same_id_regenerates_identical_scenario(self, skill):
        sid = generators.build_scenario_id(skill, 987654)
        assert generators.generate_from_id(sid) == generators.generate_from_id(sid)

    def test_different_seeds_generally_differ(self, ):
        # Not a strict guarantee for any single pair, but across a spread the
        # generator must produce variety rather than one canned question.
        titles = {generators.generate('pot_odds', s)['description'] for s in range(50)}
        assert len(titles) > 5

    def test_generated_id_matches_requested_skill_and_seed(self):
        s = generators.generate('mdf', 123)
        assert s['id'] == f'gen:mdf:{generators.VERSION}:123'
        assert s['skill'] == 'mdf'


class TestScenarioShape:
    @pytest.mark.parametrize('skill', ALL_SKILLS)
    def test_four_distinct_options_including_answer(self, skill):
        for seed in range(300):
            s = generators.generate(skill, seed)
            opts = s['options']
            assert len(opts) == 4, (skill, seed, opts)
            assert len(set(opts)) == 4, ('duplicate options', skill, seed, opts)
            assert s['correct_answer'] in opts, (skill, seed)

    @pytest.mark.parametrize('skill', ALL_SKILLS)
    def test_required_fields_present(self, skill):
        required = {
            'id', 'skill', 'title', 'description', 'hole_cards', 'board',
            'question', 'options', 'correct_answer', 'explanation',
        }
        s = generators.generate(skill, 1)
        assert required <= set(s)
        # Cards are distinct and well-formed (rank+suit).
        cards = s['hole_cards'] + s['board']
        assert len(cards) == len(set(cards))
        assert all(re.fullmatch(r'[2-9TJQKA][shdc]', c) for c in cards)


class TestAnswerCorrectness:
    def test_pot_odds_answer_is_break_even_equity(self):
        for seed in range(300):
            s = generators.generate('pot_odds', seed)
            P, B = _bet_from(s)
            expected = round(B / (P + 2 * B) * 100)
            assert s['correct_answer'] == f'{expected}%', (seed, P, B)

    def test_mdf_answer_is_pot_over_pot_plus_bet(self):
        for seed in range(300):
            s = generators.generate('mdf', seed)
            P, B = _bet_from(s)
            expected = round(P / (P + B) * 100)
            assert s['correct_answer'] == f'{expected}%', (seed, P, B)

    def test_half_pot_pot_odds_is_25_percent(self):
        # Find a seed that yields a half-pot bet and check the textbook value.
        for seed in range(500):
            s = generators.generate('pot_odds', seed)
            P, B = _bet_from(s)
            if abs(B / P - 0.5) < 1e-9:
                assert s['correct_answer'] == '25%'
                return
        pytest.fail('no half-pot pot_odds scenario generated in 500 seeds')

    def test_equity_answer_matches_out_probability(self):
        for seed in range(300):
            s = generators.generate('equity_estimation', seed)
            outs = s['meta']['outs']
            if s['meta']['timeframe'] == 'turn':
                expected = round(outs / 47 * 100)
            else:
                expected = round((1 - (47 - outs) * (46 - outs) / (47 * 46)) * 100)
            assert s['correct_answer'] == f'{expected}%', (seed, outs, s['meta'])

    def test_implied_odds_answer_matches_stack_depth(self):
        for seed in range(300):
            s = generators.generate('implied_odds', seed)
            deep = s['meta']['deep']
            ratio = s['meta']['stack_bb'] / s['meta']['call_bb']
            # Generated spots must stay clear of the ambiguous 10-15x band the
            # rule of thumb can't adjudicate.
            assert ratio >= 15 if deep else ratio <= 10, (seed, ratio)
            assert s['correct_answer'].startswith('Yes' if deep else 'No'), seed
            # The correct option must cite the *right reason*, not just the
            # right action — stack depth, not direct pot odds or hand category.
            assert ('deep enough' if deep else 'too shallow') in s['correct_answer']

    def test_preflop_answer_matches_rfi_chart(self):
        for seed in range(300):
            s = generators.generate('preflop_range', seed)
            klass = preflop_charts.hand_class(*s['hole_cards'])
            assert klass == s['meta']['hand_class'], (seed, klass)
            if preflop_charts.is_in_opening_range(s['position'], klass):
                assert s['correct_answer'].startswith('Raise to 2.5'), (seed, klass)
            else:
                assert s['correct_answer'] == 'Fold', (seed, klass)


class TestEquityOutsBruteForce:
    """The stated out count is the ground truth for every equity answer, so
    verify it independently: enumerate all 47 unseen cards and count the ones
    that actually complete the advertised draw per the treys evaluator."""

    TARGET_CLASSES = {
        'flush': {'Flush', 'Straight Flush'},
        'straight': {'Straight'},
        'both': {'Flush', 'Straight', 'Straight Flush'},
    }

    def test_stated_outs_match_enumeration(self):
        seen_targets = set()
        for seed in range(80):
            s = generators.generate('equity_estimation', seed)
            target = s['meta']['target']
            seen_targets.add(target)
            dead = set(s['hole_cards']) | set(s['board'])
            hits = 0
            for card in _FULL_DECK:
                if card in dead:
                    continue
                result = evaluate_hand(s['hole_cards'], s['board'] + [card])
                if result['hand_name'] in self.TARGET_CLASSES[target]:
                    hits += 1
            assert hits == s['meta']['outs'], (seed, target, hits, s['meta']['outs'])
        # Make sure the sweep actually exercised every template family.
        assert seen_targets == {'flush', 'straight', 'both'}
