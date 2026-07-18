"""Student-model write services shared by the quiz and live-hand endpoints.

Recording an observation is the single place mastery changes: it grades nothing
itself (callers pass an already-graded ``correct`` bool from server-side logic),
it just applies the BKT update, persists the new posterior, and appends the
append-only ``SkillObservation`` row that Module 4's analytics read. Both the
static-quiz grader and the live-hand dealer funnel through here so the BKT math
and the observation log can never diverge between the two paths.
"""
from apps.student_model.models import StudentProfile, DEFAULT_SKILLS
from apps.student_model.observations import SkillObservation
from apps.student_model.bkt_engine import update_mastery, DEFAULT_PARAMS


def record_skill_observation(user, skill: str, correct: bool, source: str,
                             reference_id: str = '') -> dict:
    """Apply one graded observation to a user's student model.

    Assumes it runs inside the caller's ``transaction.atomic()`` block (both
    callers grade + record several things together). Returns
    ``{'skill', 'correct', 'posterior_after', 'profile'}`` — the ``profile`` is
    the just-updated instance, so callers can serialize it without a second
    query.

    Raises KeyError if ``skill`` isn't a known BKT skill — an unknown skill is a
    programming error upstream, not something to silently absorb.
    """
    params = DEFAULT_PARAMS[skill]
    profile, _ = StudentProfile.objects.get_or_create(user=user)

    prior = profile.skills.get(skill, DEFAULT_SKILLS[skill])
    posterior = round(update_mastery(prior, correct, params), 4)

    profile.skills[skill] = posterior
    profile.save()

    SkillObservation.objects.create(
        user=user,
        skill=skill,
        correct=correct,
        posterior_after=posterior,
        source=source,
        reference_id=reference_id,
    )
    return {'skill': skill, 'correct': correct, 'posterior_after': posterior,
            'profile': profile}
