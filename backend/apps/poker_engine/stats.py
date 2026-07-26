"""Arena hand aggregation, independent of who is asking.

Extracted from ``HandStatsView`` so the same numbers can be computed for an
arbitrary user: the student's own Arena stats page and the instructor
dashboard's per-student drill-down must agree exactly, and the only way to
guarantee that is to have one implementation. The view keeps the HTTP concerns
(auth, response shape); this module owns the arithmetic.

Aggregation is done in Python rather than SQL because the EV fields live in
JSON columns the ORM can't sum, and a single user's hand count stays
comfortably request-sized at this milestone.
"""
from apps.poker_engine.models import HandHistory


def hand_ev_loss(hand) -> float:
    """Total graded EV loss for one completed hand, in BB."""
    total = hand.preflop_chart_deviation or 0.0
    total += sum((hand.postflop_ev_loss_by_street or {}).values())
    return total


def went_to_showdown(hand) -> bool:
    """A heads-up hand reaches showdown exactly when nobody folded."""
    return not any(a.get('op') == 'fold' for a in (hand.actions or []))


def arena_hands(user):
    """The user's completed Arena hands, oldest first.

    Excludes Exploit Lab hands (``match__isnull=False``): their opponent is a
    hidden jittered profile, so including them would corrupt bb/100 and the
    by_profile breakdown.
    """
    return (
        HandHistory.objects
        .filter(user=user, match__isnull=True)
        .order_by('timestamp')
    )


def hand_stats_for(user, include_timeline: bool = True) -> dict:
    """Decision-quality and results metrics over a user's Arena hands.

    Returns EV-loss metrics (the numbers the ITS actually teaches to) alongside
    BB won/lost (variance-laden, and framed that way by the frontend per
    project.md §1).

    Hands recorded before ``net_bb`` existed have ``net_bb=None``; they count
    toward decision-quality metrics but contribute 0 to BB totals (the timeline
    marks them ``net_bb: null``) rather than being silently dropped.

    ``include_timeline=False`` skips the per-hand series — the roster view wants
    only the headline numbers for many users at once, and the timeline is by far
    the largest part of the payload.
    """
    hands = list(arena_hands(user))

    timeline = []
    cumulative_bb = 0.0
    cumulative_ev_loss = 0.0
    ev_loss_by_street = {}
    record = {'win': 0, 'loss': 0, 'tie': 0}
    showdown = {'hands': 0, 'wins': 0}
    non_showdown = {'hands': 0, 'wins': 0}
    preflop_graded = 0
    preflop_deviations = 0
    by_profile = {}

    for i, hand in enumerate(hands, start=1):
        net = float(hand.net_bb) if hand.net_bb is not None else None
        ev_loss = hand_ev_loss(hand)
        cumulative_bb += net or 0.0
        cumulative_ev_loss += ev_loss

        record[hand.outcome] = record.get(hand.outcome, 0) + 1
        bucket = showdown if went_to_showdown(hand) else non_showdown
        bucket['hands'] += 1
        bucket['wins'] += 1 if hand.outcome == 'win' else 0

        if hand.preflop_chart_deviation is not None:
            preflop_graded += 1
            if hand.preflop_chart_deviation > 0:
                preflop_deviations += 1
        for street, loss in (hand.postflop_ev_loss_by_street or {}).items():
            ev_loss_by_street[street] = ev_loss_by_street.get(street, 0.0) + loss
        if hand.preflop_chart_deviation:
            ev_loss_by_street['preflop'] = (
                ev_loss_by_street.get('preflop', 0.0) + hand.preflop_chart_deviation
            )

        profile = hand.bot_profile or 'unknown'
        p = by_profile.setdefault(
            profile, {'hands': 0, 'wins': 0, 'net_bb': 0.0, 'ev_loss_bb': 0.0}
        )
        p['hands'] += 1
        p['wins'] += 1 if hand.outcome == 'win' else 0
        p['net_bb'] += net or 0.0
        p['ev_loss_bb'] += ev_loss

        if include_timeline:
            timeline.append({
                'hand': i,
                'hand_id': str(hand.id),
                'timestamp': hand.timestamp.isoformat(),
                'net_bb': net,
                'cumulative_bb': round(cumulative_bb, 2),
                'ev_loss_bb': round(ev_loss, 2),
                'cumulative_ev_loss_bb': round(cumulative_ev_loss, 2),
                'outcome': hand.outcome,
                'bot_profile': hand.bot_profile,
            })

    n = len(hands)
    for p in by_profile.values():
        p['net_bb'] = round(p['net_bb'], 2)
        p['ev_loss_bb'] = round(p['ev_loss_bb'], 2)
        p['bb_per_100'] = round(p['net_bb'] / p['hands'] * 100, 2)

    return {
        'hands_played': n,
        'net_bb_total': round(cumulative_bb, 2),
        'bb_per_100': round(cumulative_bb / n * 100, 2) if n else 0.0,
        'record': record,
        'showdown': showdown,
        'non_showdown': non_showdown,
        'ev_loss_total_bb': round(cumulative_ev_loss, 2),
        'ev_loss_per_hand_bb': round(cumulative_ev_loss / n, 3) if n else 0.0,
        'ev_loss_by_street': {
            s: round(v, 2) for s, v in ev_loss_by_street.items()
        },
        'preflop': {
            'graded_hands': preflop_graded,
            'deviations': preflop_deviations,
            'deviation_rate': (
                round(preflop_deviations / preflop_graded, 4)
                if preflop_graded else 0.0
            ),
        },
        'by_profile': by_profile,
        'timeline': timeline,
    }
