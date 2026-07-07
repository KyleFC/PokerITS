"""Static preflop opening (RFI) range charts.

Simplified, GTO-inspired raise-first-in ranges for 6-max cash at 100BB. These
are deliberately *pedagogical* charts — pure raise-or-fold with no mixed
frequencies — so a generated quiz always has exactly one defensible answer.
Used by the ``preflop_range`` procedural generator and, later, Module 3's EV
evaluator for grading live preflop decisions.

Hand-class notation is the standard 169-class grid: pairs ('77'), suited
('ATs') and offsuit ('KQo') combos, always written high card first. Range
tokens support the usual '+' shorthand:
  * '66+'  — that pair and every higher pair
  * 'ATs+' — fixed high card, kicker up to one below it (ATs, AJs, AQs, AKs)
  * 'T9s+' — one-gap-preserving series for connectors (T9s, JTs, QJs, KQs, AKs)
"""

RANKS = '23456789TJQKA'
_RANK_INDEX = {r: i for i, r in enumerate(RANKS)}

# Standard open size used by every chart position (BB).
OPEN_RAISE_SIZE_BB = 2.5

POSITION_NAMES = {
    'UTG': 'Under the Gun',
    'HJ': 'Hijack',
    'CO': 'Cutoff',
    'BTN': 'Button',
    'SB': 'Small Blind',
    'BB': 'Big Blind',
}


def hand_class(card1: str, card2: str) -> str:
    """Collapse two concrete cards into their 169-grid class.

    ('As', 'Ks') -> 'AKs';  ('Kd', 'Ah') -> 'AKo';  ('7h', '7s') -> '77'.
    """
    r1, s1 = card1[0], card1[1]
    r2, s2 = card2[0], card2[1]
    if _RANK_INDEX[r1] < _RANK_INDEX[r2]:
        r1, r2 = r2, r1
    if r1 == r2:
        return r1 + r2
    return r1 + r2 + ('s' if s1 == s2 else 'o')


def _expand(token: str) -> set[str]:
    """Expand one range token ('66+', 'ATs+', 'T9s+', 'QJo') into classes."""
    plus = token.endswith('+')
    core = token[:-1] if plus else token
    if len(core) == 2:  # pair
        if not plus:
            return {core}
        start = _RANK_INDEX[core[0]]
        return {r + r for r in RANKS[start:]}
    if not plus:
        return {core}
    hi, lo, suffix = _RANK_INDEX[core[0]], _RANK_INDEX[core[1]], core[2]
    if hi - lo == 1:
        # Connector series: walk both ranks up, preserving the one-gap shape.
        out = set()
        while hi < len(RANKS):
            out.add(RANKS[hi] + RANKS[lo] + suffix)
            hi += 1
            lo += 1
        return out
    # Fixed high card, kicker climbs to one below it.
    return {core[0] + RANKS[j] + suffix for j in range(lo, hi)}


def _expand_range(tokens: list[str]) -> frozenset[str]:
    out = set()
    for token in tokens:
        out.update(_expand(token))
    return frozenset(out)


# RFI (raise-first-in) charts per position, tightest to widest. SB/BB are
# deliberately absent: blind-vs-blind play mixes limps and wider dynamics that
# a binary raise/fold chart cannot represent honestly.
RFI_RANGES = {
    'UTG': _expand_range([
        '66+', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', 'A5s',
        'AJo+', 'KQo',
    ]),
    'HJ': _expand_range([
        '55+', 'A9s+', 'A5s', 'A4s', 'KTs+', 'QTs+', 'J9s+', 'T9s', '98s',
        'ATo+', 'KJo+', 'QJo',
    ]),
    'CO': _expand_range([
        '22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '87s', '76s', '65s',
        'A9o+', 'KTo+', 'QTo+', 'JTo',
    ]),
    'BTN': _expand_range([
        '22+', 'A2s+', 'K2s+', 'Q6s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '65s', '54s',
        'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o', '98o',
    ]),
}

# Hands sitting just inside / just outside each chart. The preflop generator
# oversamples these so questions concentrate on the decision boundary — the
# part of the chart students actually get wrong — instead of trivial
# AA-open / 72o-fold noise. test_preflop_charts asserts every entry really is
# on the claimed side of its chart, so these lists can never silently drift
# out of sync with RFI_RANGES.
BOUNDARY_HANDS = {
    'UTG': {
        'in': ['66', 'ATs', 'KTs', 'QTs', 'JTs', 'T9s', 'A5s', 'AJo', 'KQo'],
        'out': ['55', 'A9s', 'K9s', 'Q9s', 'J9s', '98s', 'A4s', 'ATo', 'KJo', 'QJo'],
    },
    'HJ': {
        'in': ['55', 'A9s', 'A4s', 'KTs', 'J9s', '98s', 'ATo', 'KJo', 'QJo'],
        'out': ['44', 'A8s', 'A3s', 'K9s', 'T8s', '87s', 'A9o', 'KTo', 'QTo', 'JTo'],
    },
    'CO': {
        'in': ['22', 'A2s', 'K9s', 'Q9s', 'J9s', 'T8s', '97s', '76s', '65s', 'A9o', 'KTo', 'QTo', 'JTo'],
        'out': ['K8s', 'Q8s', 'J8s', 'T7s', '96s', '86s', '75s', '54s', 'A8o', 'K9o', 'Q9o', 'J9o', 'T9o'],
    },
    'BTN': {
        'in': ['K2s', 'Q6s', 'J7s', 'T7s', '96s', '86s', '75s', '54s', 'A2o', 'K9o', 'Q9o', 'J9o', 'T9o', '98o'],
        'out': ['Q5s', 'J6s', 'T6s', '95s', '85s', '74s', '64s', '53s', 'K8o', 'Q8o', 'J8o', 'T8o', '97o', '87o'],
    },
}

# All 169 hand classes, for uniform sampling.
ALL_HAND_CLASSES = tuple(
    [r + r for r in RANKS]
    + [RANKS[i] + RANKS[j] + s for i in range(len(RANKS)) for j in range(i) for s in ('s', 'o')]
)


def is_in_opening_range(position: str, klass: str) -> bool:
    """True if the hand class is an open-raise in this position's RFI chart."""
    return klass in RFI_RANGES[position]


def range_fraction(position: str) -> float:
    """Fraction of all 1326 starting combos this position opens (combo-weighted:
    a pair class is 6 combos, suited 4, offsuit 12)."""
    combos = 0
    for klass in RFI_RANGES[position]:
        if len(klass) == 2:
            combos += 6
        elif klass[2] == 's':
            combos += 4
        else:
            combos += 12
    return combos / 1326
