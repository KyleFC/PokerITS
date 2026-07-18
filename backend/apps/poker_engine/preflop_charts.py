"""Static preflop opening (RFI) range charts — the binary "simple tier".

Pure raise-or-fold ranges for 6-max cash at 100BB, used by the
``preflop_range`` procedural generator and Module 3's EV evaluator, so a
generated quiz always has exactly one defensible answer. Since the GTO Wizard
retune these charts are *derived* from the mixed-frequency estimates in
``preflop_mixed_charts`` by rounding each hand to its majority action
(open-raise when the solver raises it >= 50% of the time), so the simple and
advanced tiers can never disagree about which side of the line a hand is on.

Hand-class notation is the standard 169-class grid: pairs ('77'), suited
('ATs') and offsuit ('KQo') combos, always written high card first. The
heads-up charts below still use the token shorthand:
  * '66+'  — that pair and every higher pair
  * 'ATs+' — fixed high card, kicker up to one below it (ATs, AJs, AQs, AKs)
  * 'T9s+' — one-gap-preserving series for connectors (T9s, JTs, QJs, KQs, AKs)
"""
from apps.poker_engine.preflop_mixed_charts import (
    RFI_MIXED,
    SB_MIXED,
    SB_OPEN_RAISE_SIZE_BB,
    simple_action,
)

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


# RFI (raise-first-in) charts per position, tightest to widest — each hand is
# in the chart iff the mixed (solver-estimated) chart raises it at least half
# the time. The BB is deliberately absent (it can only check or face a raise
# first-in); the SB gets its own three-action structures below because its
# solver strategy mixes opens with limps, which raise-or-fold can't represent.
RFI_RANGES = {
    pos: frozenset(k for k, freq in chart.items() if freq >= 0.5)
    for pos, chart in RFI_MIXED.items()
}

# Hands sitting just inside / just outside each chart. The preflop generator
# oversamples these so questions concentrate on the decision boundary — the
# part of the chart students actually get wrong — instead of trivial
# AA-open / 72o-fold noise. test_preflop_charts asserts every entry really is
# on the claimed side of its chart, so these lists can never silently drift
# out of sync with RFI_RANGES.
BOUNDARY_HANDS = {
    'UTG': {
        'in': ['44', 'A2s', 'K7s', 'Q9s', 'T8s', '65s', 'AJo', 'ATo', 'KJo'],
        'out': ['33', '22', '98s', '87s', '76s', '54s', 'K6s', 'Q8s', 'J8s', 'QJo', 'KTo', 'A9o'],
    },
    'HJ': {
        'in': ['44', 'K5s', 'Q8s', 'J8s', '97s', '87s', '76s', '65s', '54s', 'ATo', 'QJo'],
        'out': ['33', 'K4s', 'Q7s', 'J7s', '96s', '86s', 'A9o', 'KTo', 'QTo', 'JTo', 'T9o'],
    },
    'CO': {
        'in': ['22', 'K3s', 'Q6s', 'J7s', 'T7s', '86s', '65s', '54s', 'A9o', 'KTo', 'QTo', 'JTo'],
        'out': ['K2s', 'Q5s', 'J6s', 'T6s', '96s', '85s', '75s', '64s', '53s', '43s', 'A8o', 'K9o', 'Q9o', 'J9o', 'T9o'],
    },
    'BTN': {
        'in': ['J4s', 'T6s', '95s', '85s', '75s', '64s', '53s', 'A3o', 'K8o', 'Q9o', 'J9o', 'T8o', '98o'],
        'out': ['J3s', 'T5s', '94s', '84s', '74s', '63s', '52s', '43s', 'A2o', 'K7o', 'Q8o', 'J8o', 'T7o', '97o', '87o'],
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


def _combo_fraction(ranges) -> float:
    """Fraction of all 1326 starting combos in a set of hand classes
    (combo-weighted: a pair class is 6 combos, suited 4, offsuit 12)."""
    combos = 0
    for klass in ranges:
        if len(klass) == 2:
            combos += 6
        elif klass[2] == 's':
            combos += 4
        else:
            combos += 12
    return combos / 1326


def range_fraction(position: str) -> float:
    """Fraction of all 1326 starting combos this 6-max position opens."""
    return _combo_fraction(RFI_RANGES[position])


# --------------------------------------------------------------------------- #
# Small blind (6-max) — three-action simple chart
# --------------------------------------------------------------------------- #
# The SB's solver strategy mixes 3.5BB opens with limps, so its simple tier
# rounds every hand to raise / call / fold instead of raise / fold. Derived
# from SB_MIXED the same way RFI_RANGES is derived from RFI_MIXED.
SB_SIMPLE = {
    action: frozenset(k for k in SB_MIXED if simple_action('SB', k) == action)
    for action in ('raise', 'call')
}


def sb_vpip_fraction() -> float:
    """Fraction of all 1326 combos the simple SB chart plays (raise or call)."""
    return _combo_fraction(SB_SIMPLE['raise'] | SB_SIMPLE['call'])


# --------------------------------------------------------------------------- #
# Heads-up (2-handed) charts
# --------------------------------------------------------------------------- #
# Heads-up is a different game from 6-max: only the Button and the Big Blind are
# dealt in, and the Button posts the small blind (see the seat ordering in
# replay.py — heads-up index 0 = BB, index 1 = SB/BTN). The SB/Button acts first
# preflop but holds position on every later street, so it opens a very wide
# range; the BB, closing the action and getting a price, defends nearly as wide.
#
# The 6-max SB above needs a three-action chart because full-ring blind-vs-
# blind mixes limps into the strategy. Pure heads-up SB-vs-BB does *not* have
# that problem: the Button's decision is a clean open-or-fold, and the BB's is
# a clean continue (call-or-3-bet) vs fold.
# The call/3-bet split inside "defend" is a mixing detail a binary chart can't
# capture, so BB questions are scoped to the defend/fold boundary only.
#
# Keyed by seat label, matching the engine's heads-up seat names:
#   'SB' — the Button, small blind, first to act preflop (open-raise chart)
#   'BB' — the big blind, closing the action (defend chart, vs a Button open)
HU_OPEN_RAISE_SIZE_BB = 2.5  # Button min-open size used for heads-up questions

HU_RANGES = {
    # SB/Button open-raise (raise-first-in): all pairs, all suited, and every
    # ace/king offsuit, tapering off through the weaker offsuit hands (~82%).
    'SB': _expand_range([
        '22+',
        'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T2s+', '92s+', '82s+', '72s+',
        '62s+', '52s+', '42s+', '32s',
        'A2o+', 'K2o+', 'Q2o+', 'J4o+', 'T6o+', '95o+', '85o+', '74o+',
        '64o+', '53o+',
    ]),
    # BB defend (call or 3-bet) vs a Button open: all pairs and suited, plus the
    # offsuit hands with enough equity/playability to continue getting a price
    # closing the action (~59%). Weaker offsuit hands fold.
    'BB': _expand_range([
        '22+',
        'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T2s+', '92s+', '82s+', '72s+',
        '62s+', '52s+', '42s+', '32s',
        'A2o+', 'K5o+', 'Q8o+', 'J8o+', 'T8o+', '98o', '87o', '76o', '65o',
    ]),
}

# Full seat-role names for heads-up prose (the SB is the Button in HU).
HU_POSITION_NAMES = {
    'SB': 'Button (Small Blind)',
    'BB': 'Big Blind',
}

# Hands sitting just inside / just outside each heads-up chart, oversampled by a
# future heads-up generator so questions land on the decision boundary rather
# than on trivial premiums/trash. test_preflop_charts asserts every entry really
# is on the claimed side, so these can never drift out of sync with HU_RANGES.
HU_BOUNDARY_HANDS = {
    'SB': {
        'in': ['Q2o', 'J4o', 'T6o', '95o', '85o', '74o', '64o', '53o', '32s', '22'],
        'out': ['J3o', 'T5o', '94o', '84o', '73o', '63o', '52o', '43o', '32o', '92o'],
    },
    'BB': {
        'in': ['K5o', 'Q8o', 'J8o', 'T8o', '98o', '87o', '76o', '65o'],
        'out': ['K4o', 'Q7o', 'J7o', 'T7o', '97o', '86o', '75o', '64o', '54o'],
    },
}


def is_hu_open(klass: str) -> bool:
    """True if the hand class is a heads-up SB/Button open-raise."""
    return klass in HU_RANGES['SB']


def is_hu_defend(klass: str) -> bool:
    """True if the hand class is a heads-up BB defend vs a Button open."""
    return klass in HU_RANGES['BB']


def hu_range_fraction(role: str) -> float:
    """Fraction of all 1326 starting combos in a heads-up chart ('SB'/'BB')."""
    return _combo_fraction(HU_RANGES[role])
