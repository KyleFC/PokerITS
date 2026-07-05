"""Bayesian Knowledge Tracing (BKT) Engine

Pure-function implementation of BKT for the Poker ITS student model.
No ORM calls, no database access, no I/O — just math.

BKT Parameters (per skill):
- P(L0): Prior probability the student already knows the skill (before any observations)
- P(T):  Probability of transitioning from unlearned to learned on each opportunity  
- P(G):  Probability of guessing correctly despite not knowing (guess rate)
- P(S):  Probability of slipping (answering wrong despite knowing)

Default Parameter Rationale:
- P(L0) = 0.30: Assumes beginners with some poker exposure but not trained
- P(T) = 0.10: Conservative learning rate — skills take multiple correct
  observations to master, reflecting that poker concepts require repeated
  application to internalize
- P(G) = 0.25: Typical for 4-option multiple choice (1/4 chance of random correct)
- P(S) = 0.10: Low slip rate — if a student truly understands pot odds,
  they rarely miscalculate. Higher than 0.05 to account for careless errors.
- Mastery threshold = 0.95: Student is considered to have mastered a skill
  when P(L_n) >= 0.95
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class BKTParams:
    p_l0: float   # Prior knowledge probability
    p_t: float    # Learning/transition probability  
    p_g: float    # Guess probability
    p_s: float    # Slip probability

MASTERY_THRESHOLD = 0.95

# Default BKT parameters per skill
DEFAULT_PARAMS = {
    'preflop_range': BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10),
    'equity_estimation': BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10),
    'pot_odds': BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10),
    'implied_odds': BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10),
    'mdf': BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10),
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

def is_mastered(mastery: float) -> bool:
    """Check if a skill meets the mastery threshold."""
    return mastery >= MASTERY_THRESHOLD

def get_weakest_skill(skills: dict[str, float]) -> str:
    """Return the skill name with the lowest mastery estimate."""
    return min(skills, key=skills.get)

def get_skills_below_threshold(skills: dict[str, float], threshold: float = MASTERY_THRESHOLD) -> list[str]:
    """Return skill names below the given threshold, sorted weakest first."""
    below = [(skill, mastery) for skill, mastery in skills.items() if mastery < threshold]
    below.sort(key=lambda x: x[1])
    return [skill for skill, _ in below]
