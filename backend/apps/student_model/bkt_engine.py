"""Bayesian Knowledge Tracing (BKT) Engine

Pure-function implementation of BKT for the Poker ITS student model.
No ORM calls, no database access, no I/O — just math.

BKT Parameters (per skill):
- P(L0): Prior probability the student already knows the skill (before any observations)
- P(T):  Probability of transitioning from unlearned to learned on each opportunity
- P(G):  Probability of guessing correctly despite not knowing (guess rate)
- P(S):  Probability of slipping (answering wrong despite knowing)

Parameter rationale (retuned from the initial uniform placeholders):

The placeholders (P(G)=0.25, P(T)=0.10 for every skill) let three correct
answers in a row master a skill (0.30 -> 0.65 -> 0.88 -> 0.97). Two problems
drove that: P(G)=0.25 makes each correct answer very strong evidence
(likelihood ratio (1-P(S))/P(G) = 3.6x), and P(T)=0.10 inflates mastery every
opportunity regardless of evidence.

More importantly, the guess rate is item-format-specific and the placeholders
ignored that. P(G) is the chance a *non-master* answers correctly — and for the
binary, live-graded skills that is high, because a naive "always continue"
player is right most of the time (the heads-up button opens ~82% of hands, so
"always raise" matches the preflop chart ~82% of the time). So:

- Binary / live-graded skills (preflop_range, pot_odds, mdf) get P(G) ~ 0.40-0.45.
- Genuinely 4-option quiz items (equity_estimation, implied_odds,
  opponent_reading) keep P(G) ~ 0.25-0.30.
- P(T) drops to ~0.05-0.06 so mastery reflects evidence, not baked-in optimism.
- Priors are differentiated by difficulty: basics (preflop_range) start higher,
  advanced skills (implied_odds) lower.

With these, mastery needs ~5 clean reps instead of 3, and is gated further by a
minimum observation count (see is_mastered) so a lucky streak can't master a
skill on too little evidence.

- Mastery threshold = 0.95: a skill's posterior must reach P(L_n) >= 0.95, AND
  at least MASTERY_MIN_OBSERVATIONS observations must exist for it.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class BKTParams:
    p_l0: float   # Prior knowledge probability
    p_t: float    # Learning/transition probability
    p_g: float    # Guess probability
    p_s: float    # Slip probability

    def __post_init__(self):
        # Identifiability / plausibility bounds (Baker et al.): a non-master must
        # not be more likely to answer correctly than incorrectly by guessing,
        # a master must not slip more than half the time, and the two together
        # must leave a real signal. Guards a future retune / EM fit from
        # producing "degenerate" params where knowing the skill hurts you.
        if not 0.0 <= self.p_l0 <= 1.0:
            raise ValueError(f"p_l0 must be in [0, 1], got {self.p_l0}")
        if not 0.0 <= self.p_t <= 1.0:
            raise ValueError(f"p_t must be in [0, 1], got {self.p_t}")
        if not 0.0 <= self.p_g < 0.5:
            raise ValueError(f"p_g must be in [0, 0.5), got {self.p_g}")
        if not 0.0 <= self.p_s < 0.5:
            raise ValueError(f"p_s must be in [0, 0.5), got {self.p_s}")

MASTERY_THRESHOLD = 0.95

# A skill is not declared mastered until it has at least this many observations,
# no matter how high the posterior climbs. Decouples "the estimate is high" from
# "we have seen enough to trust it" — the structural guard against a lucky short
# streak mastering a skill. Roughly the reps the retuned params need to legitimately
# cross the threshold, so it rarely binds for a genuine master but always catches
# a fluke.
MASTERY_MIN_OBSERVATIONS = 5

# Default BKT parameters per skill. See the module docstring for the rationale;
# these are principled priors pending an EM fit on the observation log.
DEFAULT_PARAMS = {
    # Basic; graded live as a near-binary chart-match with a high base-correct
    # rate, so a high guess rate and a higher prior.
    'preflop_range': BKTParams(p_l0=0.35, p_t=0.06, p_g=0.45, p_s=0.10),
    # Bucketed equity estimate — closer to 4-option, and easy to misjudge.
    'equity_estimation': BKTParams(p_l0=0.25, p_t=0.06, p_g=0.30, p_s=0.12),
    # Call/fold facing a bet is near-binary with a high base-correct rate.
    'pot_odds': BKTParams(p_l0=0.30, p_t=0.06, p_g=0.45, p_s=0.10),
    # Advanced; defend-frequency decision, binary-ish but harder to get right.
    'mdf': BKTParams(p_l0=0.25, p_t=0.05, p_g=0.40, p_s=0.12),
    # Advanced set-mining judgement; 4-option statements.
    'implied_odds': BKTParams(p_l0=0.20, p_t=0.05, p_g=0.30, p_s=0.12),
    # Opponent reading (Exploit Lab, Module 5). Lowest prior — nothing else in
    # the ITS teaches it. Keeps a higher transition than the others because each
    # match is a large, deliberate evidence packet; guess 0.30 for the 4-option
    # diagnosis.
    'opponent_reading': BKTParams(p_l0=0.20, p_t=0.10, p_g=0.30, p_s=0.12),
}

def update_mastery(prior: float, observed_correct: bool, params: BKTParams) -> float:
    """Update mastery estimate given a single observation.
    
    Implements the standard BKT update equations:
    1. Compute P(L_n | obs) using Bayes' rule
    2. Apply learning transition: P(L_n+1) = P(L_n | obs) + (1 - P(L_n | obs)) * P(T)
    
    Args:
        prior: Current mastery estimate P(L_n), between 0 and 1
        observed_correct: Whether the student answered correctly
        params: BKT parameters for this skill
    
    Returns:
        Updated mastery estimate P(L_n+1), between 0 and 1
    """
    # Step 1: Posterior update via Bayes' rule
    if observed_correct:
        # P(correct | learned) = 1 - P(S)
        # P(correct | not learned) = P(G)  
        p_correct = prior * (1 - params.p_s) + (1 - prior) * params.p_g
        p_learned_given_obs = (prior * (1 - params.p_s)) / p_correct
    else:
        # P(incorrect | learned) = P(S)
        # P(incorrect | not learned) = 1 - P(G)
        p_incorrect = prior * params.p_s + (1 - prior) * (1 - params.p_g)
        p_learned_given_obs = (prior * params.p_s) / p_incorrect
    
    # Step 2: Learning transition
    posterior = p_learned_given_obs + (1 - p_learned_given_obs) * params.p_t
    
    return posterior

def update_mastery_sequence(prior: float, observations: list[bool], params: BKTParams) -> list[float]:
    """Update mastery over a sequence of observations.
    
    Args:
        prior: Starting mastery estimate
        observations: List of correct/incorrect observations
        params: BKT parameters for this skill
    
    Returns:
        List of posterior mastery estimates (one per observation)
    """
    posteriors = []
    current = prior
    for obs in observations:
        current = update_mastery(current, obs, params)
        posteriors.append(current)
    return posteriors

def is_mastered(mastery: float, n_observations: int,
                min_obs: int = MASTERY_MIN_OBSERVATIONS) -> bool:
    """Whether a skill counts as mastered: high posterior AND enough evidence.

    BKT can spike the posterior on a short lucky streak, so a high estimate on
    its own is not trustworthy. Requiring ``min_obs`` observations decouples the
    confidence of the estimate from the amount of evidence behind it — the
    structural guard against premature mastery. ``n_observations`` is the count
    of recorded observations for this skill (``SkillObservation`` rows).
    """
    return mastery >= MASTERY_THRESHOLD and n_observations >= min_obs

def get_weakest_skill(skills: dict[str, float]) -> str:
    """Return the skill name with the lowest mastery estimate."""
    return min(skills, key=skills.get)

def get_skills_below_threshold(skills: dict[str, float], threshold: float = MASTERY_THRESHOLD) -> list[str]:
    """Return skill names below the given threshold, sorted weakest first."""
    below = [(skill, mastery) for skill, mastery in skills.items() if mastery < threshold]
    below.sort(key=lambda x: x[1])
    return [skill for skill, _ in below]
