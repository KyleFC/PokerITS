"""Hand evaluation wrapper around the treys library.

Provides a clean API for hand ranking and comparison.
Equity calculation (Monte Carlo) is stubbed for Module 3.
"""
from treys import Card, Evaluator, Deck

# Singleton evaluator instance
_evaluator = Evaluator()

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
    board: list[str],
    num_opponents: int = 1,
    num_simulations: int = 10000,
    seed: int | None = None,
) -> float:
    """Estimate hand equity via Monte Carlo simulation.
    
    Stubbed for Module 3. Will run random rollouts against
    random opponent hands to estimate win probability.
    """
    raise NotImplementedError("Monte Carlo equity estimation is a Module 3 feature.")
