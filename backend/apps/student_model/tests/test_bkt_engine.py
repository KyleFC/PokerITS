import pytest
from apps.student_model.bkt_engine import (
    update_mastery, update_mastery_sequence, is_mastered,
    get_weakest_skill, get_skills_below_threshold,
    BKTParams, DEFAULT_PARAMS, MASTERY_THRESHOLD
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
    def test_is_mastered_above_threshold(self):
        assert is_mastered(0.96) is True
    
    def test_is_mastered_below_threshold(self):
        assert is_mastered(0.80) is False
    
    def test_get_weakest_skill(self):
        skills = {'a': 0.5, 'b': 0.2, 'c': 0.8}
        assert get_weakest_skill(skills) == 'b'
    
    def test_get_skills_below_threshold(self):
        skills = {'a': 0.5, 'b': 0.96, 'c': 0.3}
        below = get_skills_below_threshold(skills)
        assert below == ['c', 'a']  # sorted weakest first
        assert 'b' not in below
