"""Contract tests for the scripted hand replay builder.

These tests are the guardrail that keeps the scenario scripts honest: they run
every scenario's ``gameplay`` script through PokerKit and assert that the
resulting decision-point state matches the fields the quiz declares. If an
author writes an inconsistent script (wrong pot, illegal action, wrong actor
order, script that does not end on the hero), one of these fails.
"""
import json

import pytest
from rest_framework.test import APIClient

from apps.poker_engine.replay import build_replay, ReplayError
from apps.poker_engine.scenario_bank import load_scenarios

ALL_SCENARIOS = load_scenarios()
SCENARIO_IDS = [s['id'] for s in ALL_SCENARIOS]
# Distinctive answer-key text that must never reach the client. ``correct_answer``
# is deliberately excluded from string-matching: it is always one of the public
# ``options``, so matching its value proves nothing — its *absence as a field* is
# what matters, checked structurally in the endpoint test.
ANSWER_KEY_TEXT_FIELDS = ('explanation', 'ev_notes')


def _by_id(scenario_id):
    return next(s for s in ALL_SCENARIOS if s['id'] == scenario_id)


@pytest.mark.parametrize('scenario', ALL_SCENARIOS, ids=SCENARIO_IDS)
class TestScenarioReplayContract:
    def test_gameplay_block_well_formed(self, scenario):
        gp = scenario.get('gameplay')
        assert gp, f"{scenario['id']} has no gameplay block"
        assert scenario.get('question_type') in ('action', 'concept')
        seats = gp['seats']
        assert len(set(seats)) == len(seats), 'seat labels must be unique'
        assert gp['hero'] in seats
        for seat in seats:
            assert seat in gp['stacks'], f"missing stack for {seat}"

    def test_build_replay_runs(self, scenario):
        # Building without raising proves every scripted action is legal poker
        # (PokerKit raises on illegal actions / duplicate cards) and that the
        # script ends on the hero's turn.
        replay = build_replay(scenario)
        assert replay['frames'], 'expected at least one frame'
        assert replay['hero'] == scenario['gameplay']['hero']

    def test_decision_frame_matches_declared_fields(self, scenario):
        replay = build_replay(scenario)
        decision = replay['frames'][-1]
        hero = replay['hero']

        assert decision['kind'] == 'decision'
        assert decision['board'] == scenario['board']
        assert decision['hero_cards'] == scenario['hole_cards']
        assert decision['pot_bb'] == pytest.approx(scenario['pot_size_bb'], abs=0.01)
        # stack_size_bb is the hero's effective *starting* stack.
        assert scenario['gameplay']['stacks'][hero] == pytest.approx(
            scenario['stack_size_bb'], abs=0.01
        )
        # The hero's gameplay seat must equal the quiz's stated position.
        assert scenario['gameplay']['hero'] == scenario['position']

    def test_action_options_are_legal(self, scenario):
        if scenario.get('question_type') != 'action':
            pytest.skip('not an action-type scenario')

        gp = scenario['gameplay']
        action_options = gp.get('action_options', {})
        assert set(action_options.keys()) == set(scenario['options']), \
            'every quiz option must map to a poker action and vice versa'

        decision = build_replay(scenario)['frames'][-1]
        legal = decision['legal_actions']
        legal_types = {la['type'] for la in legal}
        for option, spec in action_options.items():
            op = spec['op']
            if op == 'fold':
                assert 'fold' in legal_types, f"{option!r}: fold not legal"
            elif op == 'check_call':
                assert {'check', 'call'} & legal_types, f"{option!r}: check/call not legal"
            elif op == 'raise_to':
                raise_action = next((la for la in legal if la['type'] == 'raise_to'), None)
                assert raise_action, f"{option!r}: raising not legal"
                assert raise_action['min_bb'] - 0.01 <= spec['amount'] <= raise_action['max_bb'] + 0.01, \
                    f"{option!r}: amount {spec['amount']} outside legal raise bounds"
            else:
                pytest.fail(f"{option!r}: unknown op {op!r}")

    def test_deterministic(self, scenario):
        assert build_replay(scenario) == build_replay(scenario)

    def test_no_answer_key_leak(self, scenario):
        replay = build_replay(scenario)
        blob = json.dumps(replay)
        for field in ANSWER_KEY_TEXT_FIELDS:
            value = scenario.get(field)
            if value:
                assert str(value) not in blob, f"replay leaked {field}"

    def test_only_hero_cards_are_revealed(self, scenario):
        # Frames carry the board and the hero's cards only; villain hole cards
        # are never placed in a frame, so nothing else can be revealed.
        replay = build_replay(scenario)
        frame_card_keys = {'board', 'hero_cards'}
        for frame in replay['frames']:
            assert frame_card_keys <= set(frame), 'frame missing expected card fields'
            # No frame gains any additional card-bearing field beyond board/hero.
            extra_card_fields = {
                k for k, v in frame.items()
                if k not in frame_card_keys and isinstance(v, list)
                and any(isinstance(x, str) and len(x) == 2 and x[0] in '23456789TJQKA' for x in v)
            }
            assert not extra_card_fields, f"unexpected card field(s): {extra_card_fields}"
        assert replay['frames'][-1]['hero_cards'] == scenario['hole_cards']


class TestReplayValidation:
    def test_missing_gameplay_raises(self):
        with pytest.raises(ReplayError):
            build_replay({'id': 'x'})

    def test_hero_not_in_seats_raises(self):
        with pytest.raises(ReplayError):
            build_replay({
                'id': 'x',
                'gameplay': {
                    'small_blind': 0.5, 'big_blind': 1.0,
                    'seats': ['BB', 'BTN'], 'hero': 'CO',
                    'stacks': {'BB': 100, 'BTN': 100}, 'script': [],
                },
            })

    def test_wrong_actor_order_raises(self):
        # Script claims BB acts first preflop, but heads-up the button acts first.
        with pytest.raises(ReplayError):
            build_replay({
                'id': 'x',
                'gameplay': {
                    'small_blind': 0.5, 'big_blind': 1.0,
                    'seats': ['BB', 'BTN'], 'hero': 'BTN',
                    'stacks': {'BB': 100, 'BTN': 100},
                    'script': [{'op': 'fold', 'actor': 'BB'}],
                },
            })

    def test_script_not_ending_on_hero_raises(self):
        # BTN opens, BB is left to act, but hero is declared as BTN.
        with pytest.raises(ReplayError):
            build_replay({
                'id': 'x',
                'gameplay': {
                    'small_blind': 0.5, 'big_blind': 1.0,
                    'seats': ['BB', 'BTN'], 'hero': 'BTN',
                    'stacks': {'BB': 100, 'BTN': 100},
                    'script': [{'op': 'raise_to', 'actor': 'BTN', 'amount': 3}],
                },
            })


class TestReplayEndpoint:
    def test_replay_endpoint_returns_frames(self):
        client = APIClient()
        resp = client.get('/api/poker/scenarios/preflop_01/replay/')
        assert resp.status_code == 200
        body = resp.json()
        assert body['frames']
        assert body['frames'][-1]['kind'] == 'decision'
        assert body['hero'] == 'UTG'
        assert 'scenario' in body

    def test_replay_endpoint_hides_answer_key(self):
        client = APIClient()
        resp = client.get('/api/poker/scenarios/pot_odds_01/replay/')
        assert resp.status_code == 200
        body = resp.json()
        scenario = _by_id('pot_odds_01')
        # Structural: the served scenario must not carry the answer-key fields.
        for field in ('correct_answer', 'explanation', 'ev_notes'):
            assert field not in body['scenario'], f"served scenario leaked {field}"
        # And the internal gameplay script (villain lines) is never serialized.
        assert 'gameplay' not in body['scenario']
        # Distinctive explanation text must not appear anywhere in the response.
        assert scenario['explanation'] not in resp.content.decode()

    def test_replay_endpoint_unknown_scenario_404(self):
        client = APIClient()
        resp = client.get('/api/poker/scenarios/does_not_exist/replay/')
        assert resp.status_code == 404
