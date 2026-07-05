from django.db import models
from django.conf import settings
import uuid

class HandHistory(models.Model):
    """Persists every completed hand for analytics and LLM tutor context.
    
    Populated by game_loop.py in Module 3. Schema defined now so
    migrations are stable.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hand_histories'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    hole_cards = models.JSONField(help_text='Player hole cards as list of card strings')
    board = models.JSONField(default=list, help_text='Community cards as list of card strings')
    actions = models.JSONField(default=list, help_text='Chronological list of action dicts')
    pot_size = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    preflop_chart_deviation = models.FloatField(null=True, blank=True, help_text='EV loss from preflop GTO deviation')
    postflop_ev_loss_by_street = models.JSONField(default=dict, help_text='EV loss breakdown by street')
    outcome = models.CharField(
        max_length=20,
        choices=[('win', 'Win'), ('loss', 'Loss'), ('tie', 'Tie')],
        default='loss'
    )

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Hand {self.id} ({self.user.username}) - {self.outcome}"
