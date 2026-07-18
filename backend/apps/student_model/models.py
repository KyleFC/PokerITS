from django.db import models
from django.conf import settings

from apps.student_model.bkt_engine import DEFAULT_PARAMS

SKILL_CHOICES = [
    ('preflop_range', 'Preflop Range'),
    ('equity_estimation', 'Equity Estimation'),
    ('pot_odds', 'Pot Odds'),
    ('implied_odds', 'Implied Odds'),
    ('mdf', 'Minimum Defense Frequency'),
    ('opponent_reading', 'Opponent Reading'),
]

# A new student's starting mastery per skill IS the BKT prior P(L0) for that
# skill. Derive it from the engine defaults so the initial profile and the BKT
# math can never silently disagree when priors are re-tuned.
DEFAULT_SKILLS = {skill: params.p_l0 for skill, params in DEFAULT_PARAMS.items()}


class StudentProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile',
    )
    skills = models.JSONField(default=dict)  # Use DEFAULT_SKILLS via save override
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.skills:
            self.skills = DEFAULT_SKILLS.copy()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"StudentProfile({self.user.username})"

from .observations import SkillObservation

