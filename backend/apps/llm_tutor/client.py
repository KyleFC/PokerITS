import os

class AnthropicClient:
    """Service layer client for interacting with Anthropic Claude API.
    
    To be fully implemented in Module 5 with rate-limiting, retries,
    timeouts, and caching.
    """
    def __init__(self):
        self.api_key = os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            # Don't fail hard at start unless we actually call it
            pass

    def generate_explanation(self, context: dict) -> str:
        """Generate a poker concept explanation using Claude.
        
        Args:
            context: dict containing hand history, EV loss, equity data, etc.
        """
        raise NotImplementedError("Anthropic API integration is a Module 5 feature.")
