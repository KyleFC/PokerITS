"""Tests for the EV evaluator and the EV-loss -> BKT observation policy.

The policy (project.md §5) is safety-critical: these tests pin the exact
threshold behaviour so it can never drift silently.
"""
import pytest

from apps.poker_engine import ev_eval


class TestRequiredEquityAndCallEV:
    def test_required_equity_half_pot(self):
        # Bet 5 into a pot of 10 (which already contains the 5 bet): call 5 to
        # win 10, so required equity = 5 / 15 = 33.3%.
        assert ev_eval.required_equity(10, 5) == pytest.approx(1 / 3)

    def test_call_ev_positive_when_equity_beats_price(self):
        # 50% equity, call 5 to win 10 -> EV = 0.5*10 - 0.5*5 = +2.5 BB.
        assert ev_eval.call_ev_bb(0.5, 10, 5) == pytest.approx(2.5)

    def test_call_ev_zero_at_exact_break_even(self):
        req = ev_eval.required_equity(10, 5)
        assert ev_eval.call_ev_bb(req, 10, 5) == pytest.approx(0.0)

    def test_call_ev_negative_below_price(self):
        assert ev_eval.call_ev_bb(0.2, 10, 5) < 0


class TestFacingBetEVLoss:
    def test_correct_call_has_zero_loss(self):
        # Strong equity: calling is best, so calling loses nothing.
        assert ev_eval.facing_bet_ev_loss('call', 0.6, 10, 5) == pytest.approx(0.0)

    def test_wrong_fold_loses_the_forgone_call_ev(self):
        # Same +EV spot, but hero folds -> loss equals EV(call).
        loss = ev_eval.facing_bet_ev_loss('fold', 0.6, 10, 5)
        assert loss == pytest.approx(ev_eval.call_ev_bb(0.6, 10, 5))
        assert loss > 0

    def test_wrong_call_loses_negative_call_ev(self):
        # Weak equity: folding is best; calling loses |EV(call)|.
        loss = ev_eval.facing_bet_ev_loss('call', 0.2, 10, 5)
        assert loss == pytest.approx(-ev_eval.call_ev_bb(0.2, 10, 5))
        assert loss > 0

    def test_correct_fold_has_zero_loss(self):
        assert ev_eval.facing_bet_ev_loss('fold', 0.2, 10, 5) == pytest.approx(0.0)

    def test_raise_counts_as_a_continue(self):
        # A raise is scored like a call for the continue/fold decision.
        assert ev_eval.facing_bet_ev_loss('raise', 0.6, 10, 5) == pytest.approx(0.0)

    def test_loss_is_never_negative(self):
        for action in ('call', 'fold', 'raise'):
            for eq in (0.1, 0.5, 0.9):
                assert ev_eval.facing_bet_ev_loss(action, eq, 12, 8) >= 0


class TestPreflopDeviation:
    def test_opening_an_in_range_hand_is_correct(self):
        # AA opens from any position.
        assert ev_eval.preflop_deviation_ev_loss(['As', 'Ad'], 'UTG', 'Raise to 2.5BB') == 0.0

    def test_folding_an_in_range_hand_is_a_deviation(self):
        loss = ev_eval.preflop_deviation_ev_loss(['As', 'Ad'], 'UTG', 'Fold')
        assert loss == ev_eval.PREFLOP_DEVIATION_PENALTY_BB

    def test_opening_trash_is_a_deviation(self):
        loss = ev_eval.preflop_deviation_ev_loss(['7h', '2d'], 'UTG', 'Raise to 2.5BB')
        assert loss == ev_eval.PREFLOP_DEVIATION_PENALTY_BB

    def test_folding_trash_is_correct(self):
        assert ev_eval.preflop_deviation_ev_loss(['7h', '2d'], 'UTG', 'Fold') == 0.0

    def test_limping_is_never_chart_correct(self):
        # Even with a premium, a limp deviates from raise-first-in.
        assert ev_eval.preflop_deviation_ev_loss(['As', 'Ad'], 'BTN', 'Call 1BB (limp)') > 0

    def test_headsup_button_opens_wider(self):
        # K5o is a heads-up button open but not a 6-max UTG open.
        assert ev_eval.preflop_deviation_ev_loss(['Kh', '5d'], 'SB', 'Raise', heads_up=True) == 0.0
        assert ev_eval.preflop_deviation_ev_loss(['Kh', '5d'], 'UTG', 'Raise') > 0

    def test_headsup_bb_defend_continue_vs_fold(self):
        # K5o is in the HU BB defend range: continuing is correct, folding not.
        assert ev_eval.preflop_deviation_ev_loss(
            ['Kh', '5d'], 'BB', 'Call', heads_up=True, facing_open=True) == 0.0
        assert ev_eval.preflop_deviation_ev_loss(
            ['Kh', '5d'], 'BB', 'Fold', heads_up=True, facing_open=True) > 0

    def test_headsup_bb_folds_trash_correctly(self):
        assert ev_eval.preflop_deviation_ev_loss(
            ['3h', '2d'], 'BB', 'Fold', heads_up=True, facing_open=True) == 0.0


class TestPolicyThresholds:
    def test_every_ev_graded_skill_has_a_threshold(self):
        from apps.student_model.bkt_engine import DEFAULT_PARAMS
        # Every BKT skill maps through the EV-loss policy *except* opponent_reading
        # (Exploit Lab), which is graded categorically (the diagnosis) and by
        # action frequency (the execution score), never by closed-form EV loss —
        # so it deliberately has no threshold here.
        ev_graded = set(DEFAULT_PARAMS) - {'opponent_reading'}
        assert set(ev_eval.EV_LOSS_THRESHOLDS) == ev_graded

    def test_preflop_zero_tolerance(self):
        assert ev_eval.ev_loss_is_correct('preflop_range', 0.0)
        assert not ev_eval.ev_loss_is_correct('preflop_range', ev_eval.PREFLOP_DEVIATION_PENALTY_BB)

    def test_postflop_tolerates_small_loss(self):
        assert ev_eval.ev_loss_is_correct('pot_odds', 0.4)
        assert not ev_eval.ev_loss_is_correct('pot_odds', 0.9)

    def test_unknown_skill_raises(self):
        with pytest.raises(KeyError):
            ev_eval.ev_loss_is_correct('nonexistent', 0.0)


class TestEvaluateDecision:
    def test_postflop_correct_call_is_a_correct_observation(self):
        result = ev_eval.evaluate_decision_ev(
            {'skill': 'pot_odds', 'action': 'call'},
            {'equity': 0.6, 'pot_before_call': 10, 'bet_to_call': 5},
        )
        assert result == {'skill': 'pot_odds', 'ev_loss_bb': 0.0, 'correct': True}

    def test_postflop_bad_call_is_incorrect(self):
        result = ev_eval.evaluate_decision_ev(
            {'skill': 'pot_odds', 'action': 'call'},
            {'equity': 0.15, 'pot_before_call': 10, 'bet_to_call': 8},
        )
        assert result['correct'] is False
        assert result['ev_loss_bb'] > 0

    def test_preflop_decision_flows_through_policy(self):
        result = ev_eval.evaluate_decision_ev(
            {'skill': 'preflop_range', 'action': 'Fold'},
            {'hole_cards': ['As', 'Ad'], 'position': 'UTG'},
        )
        assert result['correct'] is False
        assert result['ev_loss_bb'] == ev_eval.PREFLOP_DEVIATION_PENALTY_BB

    def test_unknown_skill_raises(self):
        with pytest.raises(KeyError):
            ev_eval.evaluate_decision_ev({'skill': 'bluffing', 'action': 'call'}, {})
