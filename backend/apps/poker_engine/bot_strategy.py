"""Rule-based bot strategy with adjustable playing parameters.

To be implemented in Module 3. Will support:
- Tight-passive, loose-aggressive profiles
- Overfolding / underfolding leaks
- Bluff frequencies based on current street/hand strength
"""

class RuleBasedBot:
    """A rule-based bot opponent with tunable parameters."""
    def __init__(self, profile: str = 'default'):
        self.profile = profile

    def get_action(self, hand_state: dict) -> dict:
        """Decide the bot's action based on current state and profile rules."""
        raise NotImplementedError("Bot strategy is a Module 3 feature.")
