"""Tests for the heads-up dealer state machine (game_loop.py).

Pure-engine tests — no DB — exercising deal, street advance, showdown,
deterministic reconstruction, and hero-decision grading.
"""
import pytest

from apps.poker_engine.game_loop import HeadsUpHand, HERO, SEATS
from apps.poker_engine.replay import CHIPS_PER_BB


def _play_out(hand, hero_policy):
    """Drive a hand to completion with a callable ``hero_policy(legal)->action``."""
    guard = 0
    while not hand.is_complete and guard < 60:
        guard += 1
        hand.act_hero(hero_policy(hand.legal_actions()))
    assert hand.is_complete, "hand did not terminate"
    return hand


def _passive(legal):
    """Never fold: check when possible, else call, else (forced) fold."""
    types = {a['type'] for a in legal}
    if 'check' in types:
        return {'type': 'check'}
    if 'call' in types:
        return {'type': 'call'}
    return {'type': 'fold'}


class TestDealAndSetup:
    def test_new_hand_puts_hero_first_to_act_preflop(self):
        hand = HeadsUpHand.new(1)
        assert not hand.is_complete
        assert hand.hero_to_act
        assert SEATS == ['BB', 'SB'] and HERO == 'SB'

    def test_first_frame_has_legal_actions_and_two_hero_cards(self):
        frame = HeadsUpHand.new(1).current_frame()
        assert frame['kind'] == 'decision'
        assert len(frame['hero_cards']) == 2
        types = {a['type'] for a in frame['legal_actions']}
        # As the button facing the big blind, hero can fold, call, or raise.
        assert types == {'fold', 'call', 'raise_to'}


class TestPlayToShowdown:
    @pytest.mark.parametrize('seed', range(8))
    def test_passive_line_completes_with_a_valid_result(self, seed):
        hand = _play_out(HeadsUpHand.new(seed), _passive)
        res = hand.result()
        assert res['outcome'] in ('win', 'loss', 'tie')
        assert len(res['hero_cards']) == 2
        assert len(res['villain_cards']) == 2
        assert len(res['board']) <= 5
        assert res['pot_bb'] > 0

    def test_hero_folding_preflop_ends_the_hand_as_a_loss(self):
        hand = HeadsUpHand.new(3)
        hand.act_hero({'type': 'fold'})
        assert hand.is_complete
        res = hand.result()
        assert res['outcome'] == 'loss'
        # Hero only loses the posted small blind by folding the button.
        assert res['hero_net_bb'] == pytest.approx(-0.5)

    def test_showdown_frame_reveals_villain_and_result(self):
        hand = _play_out(HeadsUpHand.new(5), _passive)
        frame = hand.current_frame()
        assert frame['kind'] == 'showdown'
        assert 'result' in frame
        assert len(frame['result']['villain_cards']) == 2
        # Nobody folded, so nobody may be presented as folded — HAND_KILLING
        # flips the showdown loser's status, which must not leak into the frame.
        assert frame['folded'] == []
        # The villain's now-public hand is exposed for face-up rendering.
        assert frame['revealed_cards'] == {'BB': frame['result']['villain_cards']}
        assert 'Showdown' in frame['narration']

    def test_fold_ended_frame_marks_only_the_folder(self):
        hand = HeadsUpHand.new(3)
        hand.act_hero({'type': 'fold'})
        frame = hand.current_frame()
        assert frame['folded'] == ['SB']
        # No showdown happened: the villain's cards stay hidden on the table.
        assert 'revealed_cards' not in frame


class TestReconstruction:
    @pytest.mark.parametrize('seed', range(6))
    def test_restore_reproduces_the_exact_hand(self, seed):
        hand = _play_out(HeadsUpHand.new(seed, profile='maniac'), _passive)
        restored = HeadsUpHand.restore(hand.serialize())
        assert restored.result() == hand.result()
        assert restored.actions == hand.actions

    def test_restore_midhand_preserves_turn_and_legal_actions(self):
        hand = HeadsUpHand.new(2)
        hand.act_hero({'type': 'call'})  # limp; bot responds, may reach flop
        if hand.is_complete:
            pytest.skip("hand ended immediately for this seed")
        restored = HeadsUpHand.restore(hand.serialize())
        assert restored.hero_to_act == hand.hero_to_act
        assert restored.legal_actions() == hand.legal_actions()


class TestNetResult:
    """hero_net_bb is what HandHistory.net_bb persists — pin its semantics."""

    @pytest.mark.parametrize('seed', range(8))
    def test_net_bb_sign_matches_outcome(self, seed):
        res = _play_out(HeadsUpHand.new(seed), _passive).result()
        if res['outcome'] == 'win':
            assert res['hero_net_bb'] > 0
        elif res['outcome'] == 'loss':
            assert res['hero_net_bb'] < 0
        else:
            assert res['hero_net_bb'] == 0

    @pytest.mark.parametrize('seed', range(8))
    def test_hand_is_zero_sum(self, seed):
        # Heads-up chips are conserved: whatever the hero nets, the bot loses.
        hand = _play_out(HeadsUpHand.new(seed), _passive)
        total = sum(hand._state.stacks)
        assert total == pytest.approx(2 * hand.stack * CHIPS_PER_BB)


class TestGrading:
    def test_preflop_decision_produces_a_preflop_range_observation(self):
        hand = HeadsUpHand.new(7)
        result = hand.act_hero({'type': 'call'})
        obs = result['observation']
        assert obs is not None
        assert obs['skill'] == 'preflop_range'
        assert isinstance(obs['correct'], bool)
        assert obs['street'] == 'preflop'

    def test_folding_the_button_records_the_open_decision(self):
        # Folding is only chart-correct for hands outside the wide HU open range.
        hand = HeadsUpHand.new(4)
        obs = hand.act_hero({'type': 'fold'})['observation']
        assert obs['skill'] == 'preflop_range'
        assert obs['ev_loss_bb'] in (0.0, 1.0)

    def test_postflop_facing_bet_grades_pot_odds(self):
        # Search seeds for a line where the hero faces a postflop bet under the
        # passive policy, then assert that decision is graded as pot_odds.
        for seed in range(40):
            hand = HeadsUpHand.new(seed)
            saw_postflop = False
            while not hand.is_complete:
                frame = hand.current_frame()
                street = frame['street']
                obs = hand.act_hero(_passive(hand.legal_actions()))['observation']
                if street != 'preflop' and obs is not None:
                    assert obs['skill'] == 'pot_odds'
                    saw_postflop = True
            if saw_postflop:
                return
        pytest.skip("no postflop bet faced across scanned seeds")


# Exploit Lab (Module 5): a jittered opponent and a grading mode that scores
# nothing but records a decision context for post-hoc frequency scoring.
_NIT_PARAMS = {
    'name': 'nit', 'defend_equity_bias': 0.14, 'value_equity': 0.70,
    'aggression': 0.55, 'bluff_freq': 0.05, 'bet_pot_fraction': 0.66,
}


class TestBotParamsAndGradingMode:
    def test_bot_params_hand_plays_to_completion(self):
        hand = HeadsUpHand.new(3, bot_params=_NIT_PARAMS, grading='exploit')
        _play_out(hand, _passive)
        assert hand.result()['outcome'] in ('win', 'loss', 'tie')

    def test_serialize_round_trips_params_and_grading(self):
        hand = HeadsUpHand.new(5, bot_params=_NIT_PARAMS, grading='exploit')
        data = hand.serialize()
        assert data['bot_params'] == _NIT_PARAMS
        assert data['grading'] == 'exploit'
        restored = HeadsUpHand.restore(data)
        assert restored.bot_params == _NIT_PARAMS
        assert restored.grading == 'exploit'

    @pytest.mark.parametrize('seed', [1, 9, 17, 23])
    def test_restore_reproduces_exploit_hand(self, seed):
        hand = HeadsUpHand.new(seed, bot_params=_NIT_PARAMS, grading='exploit')
        # Advance a couple of hero decisions, then reconstruct mid-hand.
        while hand.hero_to_act and not hand.is_complete:
            hand.act_hero(_passive(hand.legal_actions()))
            break
        restored = HeadsUpHand.restore(hand.serialize())
        assert restored.actions == hand.actions
        assert restored.current_frame() == hand.current_frame()

    def test_exploit_mode_emits_context_not_observation(self):
        hand = HeadsUpHand.new(7, bot_params=_NIT_PARAMS, grading='exploit')
        result = hand.act_hero({'type': 'call'})
        assert result['observation'] is None
        ctx = result['decision_context']
        assert ctx is not None
        assert ctx['street'] == 'preflop'
        assert 0.0 <= ctx['equity'] <= 1.0
        assert ctx['action'] == 'call'
        assert set(ctx) >= {
            'street', 'equity', 'pot_bb', 'to_call_bb', 'facing_bet',
            'action', 'amount_bb',
        }

    def test_gto_mode_unchanged_and_no_context(self):
        # Regression: default grading still produces the graded observation and
        # never a decision context.
        hand = HeadsUpHand.new(7)
        result = hand.act_hero({'type': 'call'})
        assert result['decision_context'] is None
        assert result['observation'] is not None
        assert result['observation']['skill'] == 'preflop_range'

    def test_legacy_serialized_state_defaults_to_gto(self):
        # A LiveHand row persisted before Exploit Lab has no bot_params/grading.
        hand = HeadsUpHand.new(2)
        legacy = hand.serialize()
        del legacy['bot_params']
        del legacy['grading']
        restored = HeadsUpHand.restore(legacy)
        assert restored.grading == 'gto'
        assert restored.bot_params is None
        assert restored.act_hero({'type': 'call'})['observation'] is not None
