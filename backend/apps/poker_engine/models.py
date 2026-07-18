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
    # Net result for the hero in big blinds (stack delta / big blind). Nullable
    # because rows written before this field existed have no recorded value;
    # they can be backfilled from LiveHand.state (seed + action log) if needed.
    net_bb = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Hero net result in big blinds (positive = won chips)'
    )
    bot_profile = models.CharField(
        max_length=20, blank=True, default='',
        help_text='Bot profile the hand was played against (balanced/nit/station/maniac)'
    )
    # Set for hands played inside an Exploit Lab match (Module 5); NULL for
    # ordinary Arena hands. SET_NULL so pruning a match never deletes the
    # append-only hand log. Match hands are excluded from Arena aggregates
    # (their opponent is a jittered mystery profile) and surfaced via the match
    # reveal instead.
    match = models.ForeignKey(
        'ExploitMatch', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hands',
    )
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


class LiveHand(models.Model):
    """In-progress heads-up hand state, persisted between requests.

    project.md §2 requires in-progress hand state to survive worker restarts and
    work across workers, so it lives in the DB rather than process memory. The
    row is small and fully reconstructable: ``state`` is game_loop's
    ``serialize()`` output — the seed, table config, and betting log — from which
    the exact PokerKit state is rebuilt on each action. Completed hands are
    marked ``complete`` and copied into HandHistory; the LiveHand row can then be
    pruned without losing anything analytics needs.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_hands',
    )
    state = models.JSONField(help_text="game_loop serialize() output (seed, config, actions)")
    complete = models.BooleanField(default=False)
    # Set when this hand belongs to an Exploit Lab match; the action view uses it
    # to route decision contexts and phase transitions to the match. CASCADE:
    # an in-progress hand has no meaning without its match.
    match = models.ForeignKey(
        'ExploitMatch', on_delete=models.CASCADE, null=True, blank=True,
        related_name='live_hands',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'complete']),
        ]

    def __str__(self):
        status = 'complete' if self.complete else 'in progress'
        return f"LiveHand {self.id} ({self.user.username}) - {status}"


class ExploitMatch(models.Model):
    """A heads-up 'diagnose the opponent' match (Exploit Lab, Module 5).

    The match owns a hidden, jittered bot profile and walks through three phases
    — Scout (observe), Diagnosis (a graded read + counter), Exploit (demonstrate
    the adjustment) — then Complete (full reveal). The bot's identity
    (``base_profile``/``bot_params``) is server-side only until the match is
    complete: exposing it early would give away the answer, the same discipline
    the scenario replay endpoint applies to its answer key.

    The whole match is reproducible from ``seed`` (it roots both the jitter and
    the per-hand seed stream); ``bot_params`` is stored directly anyway so the
    opponent can be rebuilt without re-deriving it.
    """
    PHASES = [
        ('scout', 'Scout'),
        ('diagnosis', 'Diagnosis'),
        ('exploit', 'Exploit'),
        ('complete', 'Complete'),
    ]
    DIFFICULTIES = [('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='exploit_matches',
    )
    difficulty = models.CharField(max_length=10, choices=DIFFICULTIES)
    # The hidden answer key — never serialized to the client before completion.
    base_profile = models.CharField(max_length=20)
    bot_params = models.JSONField(help_text='Jittered BotProfile kwargs')
    seed = models.BigIntegerField(help_text='Roots jitter + the per-hand seed stream')

    phase = models.CharField(max_length=12, choices=PHASES, default='scout')
    scout_target = models.PositiveSmallIntegerField()
    exploit_target = models.PositiveSmallIntegerField()
    scout_played = models.PositiveSmallIntegerField(default=0)
    exploit_played = models.PositiveSmallIntegerField(default=0)

    # {read, adjustment, read_correct, adjustment_correct, answered_at}
    diagnosis = models.JSONField(default=dict, blank=True)
    # Per completed hand: {hand_id, phase, net_bb, villain_cards, showdown}
    hand_log = models.JSONField(default=list, blank=True)
    # Per hero decision: _decision_context() + {phase, hand_id}
    decision_log = models.JSONField(default=list, blank=True)
    # Execution report computed at completion (exploit_stats.score_execution)
    scores = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'phase']),
        ]

    def __str__(self):
        return f"ExploitMatch {self.id} ({self.user.username}) - {self.phase}"
