"""Hand evaluation wrapper around the treys library.

Provides a clean API for hand ranking, comparison, and Monte Carlo equity.
"""
import random as _random

from treys import Card, Evaluator, Deck

# Singleton evaluator instance
_evaluator = Evaluator()

# Full 52-card deck as treys ints, computed once. Card ints are unique, so set
# membership against the known (dead) cards cleanly removes them.
_FULL_DECK_INTS = tuple(Deck.GetFullDeck())

def make_card(card_str: str) -> int:
    """Convert a human-readable card string to treys integer.
    
    Args:
        card_str: Card string like 'As', 'Kh', 'Td', '2c'
                  (Rank + suit, where T=10, suit is s/h/d/c)
    Returns:
        treys integer card representation
    """
    # Card.new in treys expects rank to be uppercase T/J/Q/K/A or 2-9
    # Suit is lowercase s/h/d/c. Card.new('As')
    return Card.new(card_str)

def make_cards(card_strs: list[str]) -> list[int]:
    """Convert a list of card strings to treys integers."""
    return [make_card(s) for s in card_strs]

def evaluate_hand(hole_cards: list[str], board: list[str]) -> dict:
    """Evaluate a poker hand.
    
    Args:
        hole_cards: List of 2 card strings (e.g., ['As', 'Kh'])
        board: List of 3-5 card strings (e.g., ['Td', '5c', '2h'])
    
    Returns:
        dict with 'rank' (int, lower=better, 1=best), 
        'rank_class' (int), 'hand_name' (str like 'Straight')
    """
    h = make_cards(hole_cards)
    b = make_cards(board)
    rank = _evaluator.evaluate(b, h)
    rank_class = _evaluator.get_rank_class(rank)
    hand_name = _evaluator.class_to_string(rank_class)
    return {
        'rank': rank,
        'rank_class': rank_class,
        'hand_name': hand_name,
    }

def compare_hands(hand1: list[str], hand2: list[str], board: list[str]) -> int:
    """Compare two hands on a given board.
    
    Returns:
        -1 if hand1 wins, 1 if hand2 wins, 0 if tie
        (lower rank = better hand in treys)
    """
    r1 = evaluate_hand(hand1, board)['rank']
    r2 = evaluate_hand(hand2, board)['rank']
    if r1 < r2:
        return -1
    elif r1 > r2:
        return 1
    return 0

def make_deck(seed: int | None = None) -> Deck:
    """Create a deck with optional seed for reproducibility.

    treys.Deck holds its own per-instance ``Random(seed)``, so passing the seed
    here gives reproducible deals without touching global RNG state — safe under
    multiple workers and concurrent requests.

    Args:
        seed: Random seed for reproducible deals. None for a random shuffle.
    """
    return Deck(seed)

def estimate_equity_monte_carlo(
    hole_cards: list[str],
    board: list[str] | None = None,
    num_opponents: int = 1,
    num_simulations: int = 10000,
    seed: int | None = None,
) -> float:
    """Estimate hero's equity (win probability) via Monte Carlo rollouts.

    Runs the board out to five cards and deals each opponent a random 2-card
    holding from the remaining deck, repeatedly, and returns the share of the
    pot hero wins on average. Split pots are credited as an equal fraction to
    each tied player, so the result is true equity, not just win rate.

    Args:
        hole_cards: Hero's two cards, e.g. ``['As', 'Kh']``.
        board: 0-5 community cards already out. None/empty = preflop.
        num_opponents: Number of random opponents to simulate against.
        num_simulations: Rollouts to run. Standard error ~ 0.5/sqrt(N), so
            10k gives ~0.5% precision; callers can trade accuracy for speed.
        seed: Seeds a local ``Random`` for reproducible rollouts. None = random.

    Returns:
        Equity as a float in ``[0.0, 1.0]``.
    """
    board = board or []
    if num_opponents < 1:
        raise ValueError("num_opponents must be at least 1")
    if num_simulations < 1:
        raise ValueError("num_simulations must be at least 1")

    rng = _random.Random(seed)
    hero = make_cards(hole_cards)
    board_ints = make_cards(board)

    dead = set(hero) | set(board_ints)
    if len(dead) != len(hero) + len(board_ints):
        raise ValueError("Duplicate cards among hole cards and board")

    deck = [c for c in _FULL_DECK_INTS if c not in dead]
    needed_board = 5 - len(board_ints)
    draw_count = num_opponents * 2 + needed_board

    if draw_count > len(deck):
        raise ValueError("Not enough cards left in the deck for this simulation")

    hero_share_total = 0.0
    for _ in range(num_simulations):
        drawn = rng.sample(deck, draw_count)
        opp_hands = [drawn[i * 2:i * 2 + 2] for i in range(num_opponents)]
        sim_board = board_ints + drawn[num_opponents * 2:]

        # treys: lower rank int = stronger hand; evaluate(board, hand).
        hero_rank = _evaluator.evaluate(sim_board, hero)
        opp_ranks = [_evaluator.evaluate(sim_board, oh) for oh in opp_hands]
        best_opp = min(opp_ranks)

        if hero_rank < best_opp:
            hero_share_total += 1.0
        elif hero_rank == best_opp:
            # Count how many opponents also tie for the win to split the pot.
            ties = opp_ranks.count(hero_rank)
            hero_share_total += 1.0 / (ties + 1)

    return hero_share_total / num_simulations
