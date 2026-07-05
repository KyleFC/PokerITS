import pytest
from apps.poker_engine.hand_eval import evaluate_hand, compare_hands, make_card, make_cards, make_deck

class TestMakeCard:
    def test_ace_of_spades(self):
        card = make_card('As')
        assert isinstance(card, int)
    
    def test_multiple_cards(self):
        cards = make_cards(['As', 'Kh', 'Qd'])
        assert len(cards) == 3
        assert all(isinstance(c, int) for c in cards)

class TestEvaluateHand:
    def test_royal_flush(self):
        result = evaluate_hand(['As', 'Ks'], ['Qs', 'Js', 'Ts'])
        assert result['hand_name'] == 'Royal Flush'
        assert result['rank'] == 1  # Best possible hand in treys
    
    def test_full_house(self):
        result = evaluate_hand(['Ah', 'Ad'], ['Ac', 'Kh', 'Kd'])
        assert result['hand_name'] == 'Full House'
    
    def test_pair(self):
        result = evaluate_hand(['Ah', 'Ad'], ['Kc', '7h', '2d'])
        assert result['hand_name'] == 'Pair'
    
    def test_flush(self):
        result = evaluate_hand(['Ah', 'Kh'], ['Qh', '7h', '2h'])
        assert result['hand_name'] == 'Flush'
    
    def test_high_card(self):
        result = evaluate_hand(['Ah', 'Kd'], ['Qc', '7h', '2s'])
        assert result['hand_name'] == 'High Card'
    
    def test_seven_card_evaluation(self):
        result = evaluate_hand(['Ah', 'Kh'], ['Qh', 'Jh', 'Th', '2c', '3d'])
        assert result['hand_name'] == 'Royal Flush'


class TestMakeDeck:
    def test_same_seed_produces_identical_order(self):
        assert make_deck(42).cards == make_deck(42).cards

    def test_different_seeds_produce_different_order(self):
        assert make_deck(1).cards != make_deck(2).cards

    def test_seeding_does_not_leak_into_other_decks(self):
        # A seeded deck must not perturb a subsequently seeded deck: the whole
        # point of per-instance RNG is that decks are independent.
        a = make_deck(7).cards
        _noise = make_deck(999).cards
        b = make_deck(7).cards
        assert a == b

    def test_deck_has_52_unique_cards(self):
        cards = make_deck(5).cards
        assert len(cards) == 52
        assert len(set(cards)) == 52


class TestCompareHands:
    def test_flush_beats_straight(self):
        board = ['Qs', 'Js', '9h', '2s', '3d']
        # Hand 1: spade flush
        # Hand 2: Q-high straight
        result = compare_hands(['As', 'Ks'], ['Th', '8h'], board)
        assert result == -1  # hand1 wins (lower rank is better)
    
    def test_higher_pair_wins(self):
        board = ['Qc', '7h', '2d', '5s', '9c']
        result = compare_hands(['Ah', 'Ad'], ['Kh', 'Kd'], board)
        assert result == -1  # AA beats KK
    
    def test_tie(self):
        board = ['Ac', 'Kc', 'Qc', 'Jc', 'Tc']
        # Both have royal flush on board
        result = compare_hands(['2h', '3h'], ['4h', '5h'], board)
        assert result == 0  # tie
