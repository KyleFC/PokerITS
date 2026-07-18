"""Rule-based heads-up bot opponent with tunable, exploitable leaks.

Deliberately NOT an LLM (project.md §7): LLMs play poker weakly, add per-action
latency, and can't be tuned to a *specific* leak. A rule-based bot can — and the
whole point is that each profile's leak maps directly onto a skill the ITS
teaches, so beating the bot *is* the exercise:

  * ``station``    under-folds  -> punish by value-betting thin (equity_estimation)
  * ``nit``        over-folds   -> punish by bluffing / betting (mdf, pot_odds)
  * ``maniac``     over-bluffs  -> punish by calling down (pot_odds, mdf)
  * ``balanced``   few leaks    -> a fair baseline

The bot is a pure function of its inputs plus an injected RNG, so it is fully
deterministic under a seeded ``random.Random`` and unit-testable in isolation.
Equity is computed by the caller (game_loop) and passed in, keeping this module
free of any board/deck bookkeeping.
"""
from dataclasses import dataclass, fields, replace

from apps.poker_engine.ev_eval import required_equity


@dataclass(frozen=True)
class BotProfile:
    """Tunable parameters for the rule-based bot.

    All frequencies are probabilities in ``[0, 1]``; equities are hero-style
    win-probabilities in ``[0, 1]``; sizes are in big blinds / pot fractions.
    """
    name: str
    # Added to the break-even calling equity when facing a bet. Positive =>
    # folds too much (the exploitable "nit" leak); negative => calls too much
    # (the "station" leak, defending below the correct threshold).
    defend_equity_bias: float
    # Equity at/above which an unbet hand is a value bet.
    value_equity: float
    # Probability of actually betting a value-strength hand when checked to.
    aggression: float
    # Probability of betting a weak (non-value) hand as a bluff when checked to.
    bluff_freq: float
    # Bet size as a fraction of the current pot (postflop and preflop raises).
    bet_pot_fraction: float = 0.66


BOT_PROFILES = {
    'balanced': BotProfile('balanced', defend_equity_bias=0.0, value_equity=0.62,
                           aggression=0.75, bluff_freq=0.18),
    'nit': BotProfile('nit', defend_equity_bias=0.12, value_equity=0.70,
                      aggression=0.55, bluff_freq=0.05),
    'station': BotProfile('station', defend_equity_bias=-0.15, value_equity=0.68,
                          aggression=0.60, bluff_freq=0.05),
    'maniac': BotProfile('maniac', defend_equity_bias=-0.05, value_equity=0.55,
                         aggression=0.90, bluff_freq=0.45),
}

DEFAULT_PROFILE = 'balanced'

# The archetype whose parameters define "no leak". Exaggeration and jitter
# (Exploit Lab, Module 5) are measured as deltas *from* this profile, so the
# leak direction is always well-defined relative to a fixed neutral baseline.
BASELINE_PROFILE = 'balanced'

# Parameters that carry a profile's leak and are therefore scaled/jittered.
# ``name`` and ``bet_pot_fraction`` are excluded: the name is an identity label
# and bet sizing is not a leak this module teaches to read.
_LEAK_PARAMS = ('defend_equity_bias', 'value_equity', 'aggression', 'bluff_freq')

# Clamp bounds keep an exaggerated/jittered profile inside sane poker ranges so
# a strong ``exaggerate`` can't produce e.g. a negative bluff frequency or an
# impossible equity threshold.
_PARAM_BOUNDS = {
    'defend_equity_bias': (-0.30, 0.30),
    'value_equity': (0.40, 0.85),
    'aggression': (0.02, 0.98),
    'bluff_freq': (0.02, 0.95),
}


def profile_params(profile: BotProfile) -> dict:
    """A ``BotProfile`` as a plain kwargs dict (round-trips via ``BotProfile(**d)``).

    Used to persist a jittered profile on an ExploitMatch row and rebuild the
    exact same bot on later requests.
    """
    return {f.name: getattr(profile, f.name) for f in fields(BotProfile)}


def _clamp(name, value):
    lo, hi = _PARAM_BOUNDS[name]
    return min(max(value, lo), hi)


def jittered_profile(base: str, exaggerate: float, rng) -> BotProfile:
    """Build a match-specific bot from an archetype.

    Each leak parameter is first *exaggerated* — pushed further from the neutral
    baseline by ``exaggerate`` (``1.0`` = the archetype as authored, ``>1`` more
    blatant, ``<1`` subtler) — then given ±15% relative noise so the same
    archetype never plays identically twice and can't be memorised. Both steps
    are clamped to ``_PARAM_BOUNDS``.

    Crucially, jitter changes only the *magnitude* of a leak, never its
    direction: an exaggerated-then-jittered ``nit`` still over-folds. The
    diagnosis answer key (exploit_profiles) depends on that invariant, which the
    tests assert directly.
    """
    if base not in BOT_PROFILES:
        raise KeyError(f"Unknown bot profile: {base}")
    archetype = BOT_PROFILES[base]
    baseline = BOT_PROFILES[BASELINE_PROFILE]

    changes = {}
    for name in _LEAK_PARAMS:
        neutral = getattr(baseline, name)
        delta = getattr(archetype, name) - neutral
        exaggerated = neutral + delta * exaggerate
        noise = 1.0 + rng.uniform(-0.15, 0.15)
        changes[name] = round(_clamp(name, exaggerated * noise), 4)
    return replace(archetype, **changes)


def _action_types(legal_actions):
    return {a['type'] for a in legal_actions}


def _find(legal_actions, kind):
    return next((a for a in legal_actions if a['type'] == kind), None)


class RuleBasedBot:
    """A rule-based bot opponent selected by profile name."""

    def __init__(self, profile=DEFAULT_PROFILE):
        """``profile`` is either a known archetype name or a ``BotProfile``.

        Passing a ``BotProfile`` directly is how Exploit Lab injects a jittered,
        match-specific opponent; passing a name keeps the original lookup path
        unchanged for every existing caller.
        """
        if isinstance(profile, BotProfile):
            self.profile = profile
        elif profile in BOT_PROFILES:
            self.profile = BOT_PROFILES[profile]
        else:
            raise KeyError(f"Unknown bot profile: {profile}")

    def get_action(self, hand_state: dict) -> dict:
        """Choose an action from ``hand_state['legal_actions']``.

        ``hand_state`` provides:
          * ``legal_actions``: list of ``{'type', ...}`` exactly as the engine
            reports them (fold / check / call / raise_to with min/max in BB).
          * ``equity``: the bot's win probability (0-1) for its actual cards.
          * ``pot_bb``: current pot in BB, *including* any live bet to call.
          * ``to_call_bb``: amount the bot must call (0 when it can check).
          * ``rng``: a ``random.Random`` for the frequency-based decisions.

        Returns one legal action dict, e.g. ``{'type': 'raise_to',
        'amount_bb': 6.0}``.
        """
        legal = hand_state['legal_actions']
        equity = hand_state['equity']
        pot = hand_state['pot_bb']
        to_call = hand_state['to_call_bb']
        rng = hand_state['rng']
        types = _action_types(legal)

        facing_bet = to_call > 0
        if facing_bet:
            return self._respond_to_bet(legal, types, equity, pot, to_call, rng)
        return self._act_unbet(legal, types, equity, pot, rng)

    # ------------------------------------------------------------------ #
    def _respond_to_bet(self, legal, types, equity, pot, to_call, rng):
        # Break-even calling equity, nudged by the profile's leak. Shares the
        # single pot-odds formula with the hero grader (ev_eval) so the bot's
        # defend threshold and the grading stay defined against the same math.
        required = required_equity(pot, to_call)
        threshold = required + self.profile.defend_equity_bias

        if equity < threshold:
            # Below (leak-adjusted) threshold: fold if allowed, else check.
            if 'fold' in types:
                return {'type': 'fold'}
            return self._check_or_call(legal, types)

        # Strong enough to continue; occasionally raise for value with a big edge.
        if equity >= self.profile.value_equity and 'raise_to' in types \
                and rng.random() < self.profile.aggression:
            return self._sized_raise(legal, pot)
        return self._check_or_call(legal, types)

    def _act_unbet(self, legal, types, equity, pot, rng):
        # First to act (or checked to): value-bet strong hands, sometimes bluff.
        can_raise = 'raise_to' in types
        if can_raise:
            if equity >= self.profile.value_equity and rng.random() < self.profile.aggression:
                return self._sized_raise(legal, pot)
            if equity < self.profile.value_equity and rng.random() < self.profile.bluff_freq:
                return self._sized_raise(legal, pot)
        return self._check_or_call(legal, types)

    # ------------------------------------------------------------------ #
    def _check_or_call(self, legal, types):
        if 'check' in types:
            return {'type': 'check'}
        call = _find(legal, 'call')
        if call is not None:
            return call
        # No check/call available (shouldn't happen when not facing a bet):
        # fall back to fold to stay legal.
        return {'type': 'fold'}

    def _sized_raise(self, legal, pot):
        """A pot-fraction raise, clamped to the engine's legal min/max."""
        raise_action = _find(legal, 'raise_to')
        lo, hi = raise_action['min_bb'], raise_action['max_bb']
        target = pot * self.profile.bet_pot_fraction
        # A raise-to must be at least the min; treat the pot fraction as an
        # increment over the current call price baked into min.
        amount = min(max(lo, round((lo + target) * 2) / 2), hi)
        return {'type': 'raise_to', 'amount_bb': amount}
