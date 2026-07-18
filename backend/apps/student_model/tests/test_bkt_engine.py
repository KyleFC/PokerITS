import pytest
from apps.student_model.bkt_engine import (
    update_mastery, update_mastery_sequence, is_mastered,
    get_weakest_skill, get_skills_below_threshold,
    BKTParams, DEFAULT_PARAMS, MASTERY_THRESHOLD, MASTERY_MIN_OBSERVATIONS,
)

# Use a fixed test params set for predictable math
TEST_PARAMS = BKTParams(p_l0=0.30, p_t=0.10, p_g=0.25, p_s=0.10)

class TestUpdateMastery:
    def test_correct_observation_increases_mastery(self):
        posterior = update_mastery(0.30, True, TEST_PARAMS)
        assert posterior > 0.30
    
    def test_incorrect_observation_decreases_mastery(self):
        posterior = update_mastery(0.30, False, TEST_PARAMS)
        assert posterior < 0.30
    
    def test_known_correct_value(self):
        # Hand-calculated: with prior=0.3, correct=True, p_s=0.1, p_g=0.25
        # P(correct) = 0.3*0.9 + 0.7*0.25 = 0.27 + 0.175 = 0.445
        # P(L|correct) = 0.27 / 0.445 = 0.60674...
        # P(L_next) = 0.60674 + 0.39326 * 0.1 = 0.60674 + 0.039326 = 0.646067...
        posterior = update_mastery(0.30, True, TEST_PARAMS)
        assert abs(posterior - 0.6461) < 0.001
    
    def test_known_incorrect_value(self):
        # P(incorrect) = 0.3*0.1 + 0.7*0.75 = 0.03 + 0.525 = 0.555
        # P(L|incorrect) = 0.03 / 0.555 = 0.05405...
        # P(L_next) = 0.05405 + 0.94595 * 0.1 = 0.05405 + 0.094595 = 0.14865...
        posterior = update_mastery(0.30, False, TEST_PARAMS)
        assert abs(posterior - 0.1487) < 0.001
    
    def test_high_prior_correct_stays_high(self):
        posterior = update_mastery(0.95, True, TEST_PARAMS)
        assert posterior > 0.95
    
    def test_sequence_of_correct_converges_toward_mastery(self):
        posteriors = update_mastery_sequence(0.30, [True]*10, TEST_PARAMS)
        assert posteriors[-1] > MASTERY_THRESHOLD
    
    def test_sequence_of_incorrect_stays_low(self):
        posteriors = update_mastery_sequence(0.30, [False]*10, TEST_PARAMS)
        assert posteriors[-1] < 0.20
    
    def test_posterior_always_between_0_and_1(self):
        for prior in [0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99]:
            for correct in [True, False]:
                p = update_mastery(prior, correct, TEST_PARAMS)
                assert 0 < p < 1

class TestHelpers:
    def test_is_mastered_high_posterior_with_enough_evidence(self):
        assert is_mastered(0.96, MASTERY_MIN_OBSERVATIONS) is True

    def test_is_mastered_below_threshold(self):
        assert is_mastered(0.80, 20) is False

    def test_get_weakest_skill(self):
        skills = {'a': 0.5, 'b': 0.2, 'c': 0.8}
        assert get_weakest_skill(skills) == 'b'

    def test_get_skills_below_threshold(self):
        skills = {'a': 0.5, 'b': 0.96, 'c': 0.3}
        below = get_skills_below_threshold(skills)
        assert below == ['c', 'a']  # sorted weakest first
        assert 'b' not in below


class TestMasteryGate:
    """A high posterior on too little evidence must not count as mastery."""

    def test_high_posterior_but_too_few_observations_is_not_mastered(self):
        assert is_mastered(0.99, MASTERY_MIN_OBSERVATIONS - 1) is False

    def test_high_posterior_at_the_min_is_mastered(self):
        assert is_mastered(0.99, MASTERY_MIN_OBSERVATIONS) is True

    def test_low_posterior_never_masters_regardless_of_evidence(self):
        assert is_mastered(0.90, 1000) is False

    def test_custom_min_obs(self):
        assert is_mastered(0.99, 3, min_obs=10) is False
        assert is_mastered(0.99, 10, min_obs=10) is True


class TestParamValidation:
    """Identifiability / plausibility guardrails on BKTParams."""

    def test_rejects_guess_rate_at_or_above_half(self):
        with pytest.raises(ValueError):
            BKTParams(p_l0=0.3, p_t=0.1, p_g=0.5, p_s=0.1)

    def test_rejects_slip_rate_at_or_above_half(self):
        with pytest.raises(ValueError):
            BKTParams(p_l0=0.3, p_t=0.1, p_g=0.3, p_s=0.6)

    def test_rejects_out_of_range_prior(self):
        with pytest.raises(ValueError):
            BKTParams(p_l0=1.5, p_t=0.1, p_g=0.3, p_s=0.1)

    def test_all_default_params_are_valid(self):
        # Construction alone runs __post_init__; this asserts the shipped params
        # satisfy the guardrails.
        for params in DEFAULT_PARAMS.values():
            assert 0.0 <= params.p_g < 0.5
            assert 0.0 <= params.p_s < 0.5


def _reps_to_master(params):
    """Consecutive correct answers from the prior needed to cross threshold."""
    mastery = params.p_l0
    reps = 0
    while mastery < MASTERY_THRESHOLD and reps < 50:
        mastery = update_mastery(mastery, True, params)
        reps += 1
    return reps


class TestDifficultyCalibration:
    """The retuned params must not let a skill be mastered on a lucky short run.

    This is the guard against the original placeholder problem, where three
    correct answers in a row mastered any skill. If a future retune makes a
    skill masterable in <= 3 reps, fix the params — do not weaken this test.
    """

    def test_no_skill_masters_in_three_or_fewer_reps(self):
        for skill, params in DEFAULT_PARAMS.items():
            reps = _reps_to_master(params)
            assert reps >= 4, f"{skill} masters in only {reps} reps"

    def test_every_skill_is_still_masterable_in_reasonable_time(self):
        for skill, params in DEFAULT_PARAMS.items():
            reps = _reps_to_master(params)
            assert reps <= 12, f"{skill} takes {reps} reps — too slow"

    def test_effective_mastery_needs_at_least_the_min_observations(self):
        # Even the fastest skill can't be *declared* mastered before the
        # observation gate is met.
        fastest = min(_reps_to_master(p) for p in DEFAULT_PARAMS.values())
        # A skill that crosses the posterior threshold in `fastest` reps still
        # isn't mastered until MASTERY_MIN_OBSERVATIONS observations exist.
        assert not is_mastered(0.99, min(fastest, MASTERY_MIN_OBSERVATIONS - 1))
