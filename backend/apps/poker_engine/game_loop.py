"""Synchronous heads-up dealer and game state machine.

To be implemented in Module 3. Will manage:
- Small/Big blinds posting
- Card dealing (seeded deck)
- Action sequence (preflop -> river)
- Pot collection and winner showdown
- Persistence of hand histories
"""

class PokerGameLoop:
    """Manages the lifecycle of a heads-up poker hand against the bot."""
    def __init__(self, seed: int | None = None):
        self.seed = seed
        # Will initialize deck, hand, street state
        pass

    def advance_state(self, player_action: dict) -> dict:
        """Process player action, let bot act, advance state, return hand state."""
        raise NotImplementedError("Game loop state machine is a Module 3 feature.")
