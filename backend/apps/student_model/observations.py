from django.db import models
from django.conf import settings

SOURCE_CHOICES = [
    ('quiz', 'Quiz'),
    ('infinite', 'Generated Quiz'),
    ('hand', 'Live Hand'),
]

class SkillObservation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='skill_observations'
    )
    skill = models.CharField(
        max_length=30,
        choices=[
            ('preflop_range', 'Preflop Range'),
            ('equity_estimation', 'Equity Estimation'),
            ('pot_odds', 'Pot Odds'),
            ('implied_odds', 'Implied Odds'),
            ('mdf', 'Minimum Defense Frequency'),
        ]
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    correct = models.BooleanField()
    posterior_after = models.FloatField(
        help_text='BKT posterior mastery estimate after this observation'
    )
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES)
    # Which scenario (quiz) or hand produced this observation. Cannot be
    # backfilled after the fact, so it is recorded from day one — Module 4
    # analytics needs to trace an observation back to its source item.
    reference_id = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Source scenario id (quiz) or hand id that produced this observation'
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'skill', 'timestamp']),
        ]

    def __str__(self):
        result = 'correct' if self.correct else 'incorrect'
        return f"{self.skill} {result} ({self.posterior_after:.2f})"
