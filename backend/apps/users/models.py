from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """Custom User model for Poker ITS.
    
    Can be extended with fields like total_hands_played, preflop_deviation_score, etc.
    """
    
    def __str__(self):
        return self.username
