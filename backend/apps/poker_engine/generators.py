"""Procedural scenario generators for infinite practice mode.

Each generator is a pure function of an integer seed: the same ``(skill, seed)``
always produces the identical scenario, *including its answer key*. This is what
lets generated quizzes be graded server-side without persisting anything.

The client is handed a scenario whose id encodes everything needed to rebuild
it — ``gen:<skill>:<version>:<seed>`` — and never sees the answer key (the
public serializer strips it, same as for the static bank). When the answer comes
back, the server regenerates the identical scenario from the id and grades
against it. Because the seed fully determines the answer, the client cannot
tamper with grading, and every ``SkillObservation.reference_id`` stays
reproducible: the exact question behind any past observation can be
reconstructed from its id alone.

The ``<version>`` segment guards historical observations: if a generator's math
or wording changes in a way that would alter the answer, bump ``VERSION`` so old
ids stop resolving (and are treated as not-found) rather than silently grading
against different content than the student saw.

No Django/ORM imports here — this module is pure so it can be unit-tested in
isolation and reused wherever a seeded scenario is needed.
"""
import random

from apps.poker_engine import preflop_charts

# Bump when a generator change would alter the answer for an existing id. Old
# ids carrying a different version simply stop resolving (graded as not-found)
# instead of grading against content the student never saw.
VERSION = 'v1'

_ID_PREFIX = 'gen'

# Deck of 'Rank+suit' strings (e.g. 'As'), matching the format used everywhere
# else (hole_cards / board / treys). Suits are cosmetic for the pot-odds and
# MDF skills — those questions are pure bet-sizing math — so a seeded shuffle is
# enough; no hand evaluation is required.
_RANKS = '23456789TJQKA'
_SUITS = 'shdc'
_FULL_DECK = [r + s for r in _RANKS for s in _SUITS]

# Pre-bet pot sizes (BB) and villain bet sizes as a fraction of that pot. Kept
# to "clean" values so generated questions read like authored ones rather than
# random arithmetic. The bet is snapped to the nearest 0.5 BB and the answer is
# then computed from the *displayed* numbers, so the prompt and answer key can
# never drift apart through rounding.
_POT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 30]
_BET_SIZES = [
    ('a third-pot bet', 1 / 3),
    ('a half-pot bet', 0.5),
    ('a two-thirds-pot bet', 2 / 3),
    ('a three-quarter-pot bet', 0.75),
    ('a pot-sized bet', 1.0),
    ('a 1.5x-pot overbet', 1.5),
    ('a 2x-pot overbet', 2.0),
]

_HERO_POSITIONS = ['BB', 'BTN', 'CO', 'SB']


# --------------------------------------------------------------------------- #
# id encoding
# --------------------------------------------------------------------------- #
def build_scenario_id(skill: str, seed: int) -> str:
    """Encode a (skill, seed) pair into a resolvable generated-scenario id."""
    return f"{_ID_PREFIX}:{skill}:{VERSION}:{seed}"


def is_generated_id(scenario_id: str) -> bool:
    """True if an id refers to a procedurally generated scenario."""
    return isinstance(scenario_id, str) and scenario_id.startswith(_ID_PREFIX + ':')


def parse_scenario_id(scenario_id: str) -> tuple[str, int] | None:
    """Decode a generated id into ``(skill, seed)``, or None if unusable.

    Returns None for anything that is not a well-formed id for a *known* skill
    at the *current* version — the caller treats that as scenario-not-found.
    """
    if not is_generated_id(scenario_id):
        return None
    parts = scenario_id.split(':')
    if len(parts) != 4:
        return None
    _, skill, version, seed_str = parts
    if version != VERSION or skill not in GENERATORS:
        return None
    try:
        seed = int(seed_str)
    except (TypeError, ValueError):
        return None
    if seed < 0:
        return None
    return skill, seed


def generate(skill: str, seed: int) -> dict:
    """Generate the full scenario dict (with answer key) for a skill + seed."""
    if skill not in GENERATORS:
        raise KeyError(f"No generator registered for skill: {skill}")
    return GENERATORS[skill](seed)


def generate_from_id(scenario_id: str) -> dict | None:
    """Resolve a generated id back to its full scenario dict, or None."""
    parsed = parse_scenario_id(scenario_id)
    if parsed is None:
        return None
    skill, seed = parsed
    return generate(skill, seed)


# --------------------------------------------------------------------------- #
# shared helpers
# --------------------------------------------------------------------------- #
def _fmt(x: float) -> str:
    """Format a BB amount: drop the decimal for whole numbers (2.0 -> '2')."""
    return str(int(x)) if float(x).is_integer() else str(round(x, 1))


_SUIT_SYMBOLS = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'}


def _pretty(card: str) -> str:
    """'As' -> 'A♠' for prose descriptions, matching the static bank's style."""
    return card[0] + _SUIT_SYMBOLS[card[1]]


def _pretty_hand(cards: list[str]) -> str:
    return ' '.join(_pretty(c) for c in cards)


def _rank_char(n: int) -> str:
    """Numeric rank (2..14) to its character ('2'..'A')."""
    return _RANKS[n - 2]


def _deal(rng: random.Random, count: int) -> list[str]:
    """Deal ``count`` distinct cards from a freshly shuffled full deck."""
    return rng.sample(_FULL_DECK, count)


def _pct_options(correct_pct: int, distractors: list[float], rng: random.Random) -> tuple[list[str], str]:
    """Build exactly four distinct ``"NN%"`` options including the correct one.

    Preferred (skill-specific, pedagogically meaningful) distractors are used
    first; generic offsets fill any remaining slots so we always return four
    distinct, in-range options no matter how the preferred ones collapse after
    rounding/clamping.
    """
    correct_pct = int(round(correct_pct))
    options = [correct_pct]
    seen = {correct_pct}

    fillers = [correct_pct + d for d in (7, -7, 11, -11, 15, -15, 20, -20, 5, -5)]
    for value in [int(round(d)) for d in distractors] + fillers:
        if len(options) == 4:
            break
        value = max(1, min(99, value))
        if value not in seen:
            seen.add(value)
            options.append(value)

    rng.shuffle(options)
    return [f"{p}%" for p in options], f"{correct_pct}%"


def _sample_river_spot(rng: random.Random) -> dict:
    """Sample the shared bet-sizing setup used by pot_odds and mdf.

    Returns pre-bet pot ``P``, villain bet ``B`` (snapped to 0.5 BB), the
    human bet-size label, board/hole cards and hero position.
    """
    pot = rng.choice(_POT_SIZES)
    size_label, fraction = rng.choice(_BET_SIZES)

    # Snap to the nearest 0.5 BB, floor at 0.5 so there is always a bet.
    bet = max(0.5, round(fraction * pot * 2) / 2)

    cards = _deal(rng, 7)
    return {
        'pot': float(pot),
        'bet': bet,
        'size_label': size_label,
        'hole_cards': cards[:2],
        'board': cards[2:7],
        'position': rng.choice(_HERO_POSITIONS),
        'bet_pct_of_pot': round(bet / pot * 100),
    }


# --------------------------------------------------------------------------- #
# skill: pot_odds
# --------------------------------------------------------------------------- #
def generate_pot_odds(seed: int) -> dict:
    """Facing a river bet: what break-even equity does a call need?

    Required equity = call / (pot after the call) = B / (P + 2B), computed from
    the exact displayed pot ``P`` and bet ``B``.
    """
    rng = random.Random(f"pot_odds:{VERSION}:{seed}")
    spot = _sample_river_spot(rng)
    P, B = spot['pot'], spot['bet']

    total_after_call = P + 2 * B
    correct_pct = round(B / total_after_call * 100)

    # Distractors mirror the classic pot-odds mistakes.
    distractors = [
        B / (P + B) * 100,   # forgetting your own call is added to the pot
        B / P * 100,         # bet over the pre-bet pot
        P / (P + B) * 100,   # this is MDF — a common concept mix-up
    ]
    options, correct_answer = _pct_options(correct_pct, distractors, rng)

    hole, board = spot['hole_cards'], spot['board']
    return {
        'id': build_scenario_id('pot_odds', seed),
        'skill': 'pot_odds',
        'title': f"Pot Odds: {spot['bet_pct_of_pot']}%-Pot River Bet",
        'description': (
            # The hand is cosmetic — required equity depends only on the price —
            # so describe the cards plainly rather than claiming a hand strength
            # the random deal usually won't match.
            f"On the river, the pot is {_fmt(P)} BB. Your opponent bets {_fmt(B)} BB "
            f"({spot['size_label']}). You hold {_pretty_hand(hole)}. "
            f"What minimum equity (win probability) do you "
            f"need to make calling a break-even decision?"
        ),
        'hole_cards': hole,
        'board': board,
        'position': spot['position'],
        'pot_size_bb': P + B,
        'stack_size_bb': 100,
        'villain_action': f"Villain bets {_fmt(B)}BB",
        'question': "What is the required break-even equity?",
        'options': options,
        'correct_answer': correct_answer,
        'explanation': (
            f"You must call {_fmt(B)} BB into a pot of {_fmt(P + B)} BB. If you call, "
            f"the total pot becomes {_fmt(total_after_call)} BB "
            f"({_fmt(P)} pre-bet + {_fmt(B)} villain bet + {_fmt(B)} your call), and "
            f"you are risking {_fmt(B)} to win it. Required equity = call / "
            f"(pot after your call) = {_fmt(B)} / {_fmt(total_after_call)} = {correct_pct}%. "
            f"If your hand wins more than {correct_pct}% of the time, calling is +EV."
        ),
        'ev_notes': (
            f"Required equity = risk / (risk + reward) = {_fmt(B)} / "
            f"({_fmt(P + B)} + {_fmt(B)}) = {correct_pct}%."
        ),
        'question_type': 'concept',
    }


# --------------------------------------------------------------------------- #
# skill: mdf
# --------------------------------------------------------------------------- #
def generate_mdf(seed: int) -> dict:
    """Facing a river bet: what is the range's minimum defense frequency?

    MDF = pot / (pot + bet) = P / (P + B), computed from the displayed numbers.
    """
    rng = random.Random(f"mdf:{VERSION}:{seed}")
    spot = _sample_river_spot(rng)
    P, B = spot['pot'], spot['bet']

    correct_pct = round(P / (P + B) * 100)

    distractors = [
        B / (P + 2 * B) * 100,  # pot-odds required equity — the mirror concept
        B / (P + B) * 100,      # alpha = bluff-to-value threshold, not MDF
        100 - correct_pct,      # the surrender frequency (1 - MDF)
    ]
    options, correct_answer = _pct_options(correct_pct, distractors, rng)

    hole, board = spot['hole_cards'], spot['board']
    alpha = B / P
    return {
        'id': build_scenario_id('mdf', seed),
        'skill': 'mdf',
        'title': f"MDF: {spot['bet_pct_of_pot']}%-Pot River Bet",
        'description': (
            f"On the river, the pot is {_fmt(P)} BB. Your opponent bets {_fmt(B)} BB "
            f"({spot['size_label']}). What is the Minimum Defense Frequency (MDF) of "
            f"your range to prevent your opponent from profitably bluffing you with "
            f"any two cards?"
        ),
        'hole_cards': hole,
        'board': board,
        'position': spot['position'],
        'pot_size_bb': P + B,
        'stack_size_bb': 100,
        'villain_action': f"Villain bets {_fmt(B)}BB",
        'question': "What is the Minimum Defense Frequency (MDF)?",
        'options': options,
        'correct_answer': correct_answer,
        'explanation': (
            f"MDF = 1 / (1 + alpha), where alpha is the bet relative to the pot "
            f"(bet / pot = {_fmt(B)} / {_fmt(P)} = {round(alpha, 2)}). "
            f"MDF = pot / (pot + bet) = {_fmt(P)} / {_fmt(P + B)} = {correct_pct}%. "
            f"You must continue (call or raise) with at least {correct_pct}% of your "
            f"range so the opponent's bluffs cannot show an automatic profit."
        ),
        'ev_notes': (
            f"Defending less than {correct_pct}% lets the opponent profitably bluff "
            f"any two cards."
        ),
        'question_type': 'concept',
    }


# --------------------------------------------------------------------------- #
# skill: equity_estimation
# --------------------------------------------------------------------------- #
# Draw templates are *constructed*, not dealt-and-checked: hole and board ranks
# come from hand-verified patterns so the stated out count is correct by
# construction (test_generators re-verifies it by brute force with treys).
# For straight templates the hero is offsuit and the board rainbow, so no
# accidental flush draw can perturb the out count; the flush template pools
# keep hero and board ranks disjoint so the draw is never already made.
_DRAW_TEMPLATES = ('flush_draw', 'oesd', 'gutshot', 'combo_draw')

# For hole (n+1, n): OESD board carries (n+2, n-1) -> outs (n-2) and (n+3);
# gutshot board carries (n+2, n-2) -> the lone out is (n-1). n is kept in
# 8..11 so every referenced rank stays inside 2..A and clear of the 2/3 filler.
_STRAIGHT_NS = (8, 9, 10, 11)
# Combo (suited hole + two flush cards on board) uses n in 7..10 so the
# straight outs (n-2, n+3) stay in range.
_COMBO_NS = (7, 8, 9, 10)


def generate_equity_estimation(seed: int) -> dict:
    """How likely is a drawing hand to complete, on the turn or by the river?"""
    rng = random.Random(f"equity_estimation:{VERSION}:{seed}")
    template = rng.choice(_DRAW_TEMPLATES)

    if template == 'flush_draw':
        suit = rng.choice(_SUITS)
        # Exclude the QJ hero combo: with two board cards in 3..9 it is the one
        # high-card pairing where a single T could also complete a straight,
        # which would muddy "your flush outs" as the only draw in play.
        hero_ranks = rng.sample(['A', 'K', 'Q', 'J'], 2)
        while set(hero_ranks) == {'Q', 'J'}:
            hero_ranks = rng.sample(['A', 'K', 'Q', 'J'], 2)
        board_ranks = rng.sample(['3', '4', '5', '6', '7', '8', '9'], 3)
        off_suit = rng.choice([s for s in _SUITS if s != suit])
        hole = [hero_ranks[0] + suit, hero_ranks[1] + suit]
        board = [board_ranks[0] + suit, board_ranks[1] + suit, board_ranks[2] + off_suit]
        outs, target = 9, 'flush'
        draw_desc = 'a flush draw (9 outs)'
        completes = 'your flush'
        title_draw = 'Flush Draw'
    elif template == 'combo_draw':
        n = rng.choice(_COMBO_NS)
        suit = rng.choice(_SUITS)
        off_suit = rng.choice([s for s in _SUITS if s != suit])
        hole = [_rank_char(n + 1) + suit, _rank_char(n) + suit]
        board = [
            _rank_char(n + 2) + suit,
            _rank_char(n - 1) + suit,
            rng.choice(['2', '3']) + off_suit,
        ]
        # 9 flush + 8 straight - 2 straight-flush cards counted twice.
        outs, target = 15, 'both'
        # Deliberately NOT stating the out count: combining the two draws
        # without double-counting the overlap is the lesson here.
        draw_desc = 'both a flush draw and an open-ended straight draw'
        completes = 'at least one of your draws'
        title_draw = 'Combo Draw (Flush + OESD)'
    else:
        n = rng.choice(_STRAIGHT_NS)
        hero_suits = rng.sample(_SUITS, 2)
        board_suits = rng.sample(_SUITS, 3)  # rainbow
        hole = [_rank_char(n + 1) + hero_suits[0], _rank_char(n) + hero_suits[1]]
        filler = rng.choice(['2', '3'])
        if template == 'oesd':
            board_ranks = [_rank_char(n + 2), _rank_char(n - 1), filler]
            outs, target = 8, 'straight'
            draw_desc = 'an open-ended straight draw (8 outs)'
            title_draw = 'Open-Ended Straight Draw'
        else:
            board_ranks = [_rank_char(n + 2), _rank_char(n - 2), filler]
            outs, target = 4, 'straight'
            draw_desc = 'a gutshot straight draw (4 outs)'
            title_draw = 'Gutshot Straight Draw'
        completes = 'your straight'
        board = [r + s for r, s in zip(board_ranks, board_suits)]

    timeframe = rng.choice(['turn', 'river'])
    if timeframe == 'turn':
        raw = outs / 47 * 100
        when = 'on the very next card (the turn)'
        rule = f"The rule of 2 approximates this as {outs} × 2 = {outs * 2}%."
        math = f"With {outs} outs and 47 unseen cards, P = {outs}/47 ≈ {raw:.1f}%."
    else:
        raw = (1 - (47 - outs) * (46 - outs) / (47 * 46)) * 100
        when = 'by the river (turn and river combined)'
        rule = f"The rule of 4 approximates this as {outs} × 4 = {outs * 4}%."
        math = (
            f"With {outs} outs: P(miss both cards) = {47 - outs}/47 × {46 - outs}/46 "
            f"≈ {100 - raw:.1f}%, so P(hit) ≈ {raw:.1f}%."
        )
    correct_pct = round(raw)

    turn_pct = round(outs / 47 * 100)
    river_pct = round((1 - (47 - outs) * (46 - outs) / (47 * 46)) * 100)
    # Classic mistakes: quoting the other timeframe's number, or misapplying
    # the rule of 2/4. For the combo draw, add the naive 9+8=17-out figure that
    # forgets the straight-flush overlap.
    distractors = [river_pct if timeframe == 'turn' else turn_pct, outs * 4, outs * 2]
    if template == 'combo_draw':
        distractors.insert(0, 17 * 2 if timeframe == 'turn' else 17 * 4)
    options, correct_answer = _pct_options(correct_pct, distractors, rng)

    combo_note = (
        "You have 9 flush outs plus 8 straight outs, minus the 2 straight-flush "
        "cards counted twice: 15 clean outs. "
        if template == 'combo_draw' else ''
    )
    return {
        'id': build_scenario_id('equity_estimation', seed),
        'skill': 'equity_estimation',
        'title': f"Equity: {title_draw}",
        'description': (
            f"You hold {_pretty_hand(hole)} on a flop of {_pretty_hand(board)}. "
            f"You have {draw_desc}. What is the probability of completing "
            f"{completes} {when}?"
        ),
        'hole_cards': hole,
        'board': board,
        'position': rng.choice(['BTN', 'CO']),
        'pot_size_bb': float(rng.choice([6, 8, 10, 12])),
        'stack_size_bb': 100,
        'villain_action': 'Villain checks',
        'question': f"What is the probability of completing {completes} {when}?",
        'options': options,
        'correct_answer': correct_answer,
        'explanation': f"{combo_note}{math} {rule}",
        'ev_notes': (
            "Single-street probability ≈ outs × 2; two streets ≈ outs × 4. "
            "Exact values run slightly under the rule of 4 for big draws."
        ),
        'question_type': 'concept',
        # Internal fields for tests; PublicScenarioSerializer never emits them.
        'meta': {'outs': outs, 'timeframe': timeframe, 'target': target},
    }


# --------------------------------------------------------------------------- #
# skill: implied_odds
# --------------------------------------------------------------------------- #
def generate_implied_odds(seed: int) -> dict:
    """Set-mining decision: do stack depths justify calling with a small pair?

    Direct pot odds never justify the call (flopping a set is ~7.5:1 against),
    so the answer hinges entirely on the stack-to-call ratio. Scenarios are
    generated only in the clearly-deep (≥ ~20x) or clearly-shallow (≤ ~8x)
    zones so the 15–20x rule of thumb always gives one defensible answer.
    """
    rng = random.Random(f"implied_odds:{VERSION}:{seed}")

    villain_pos = rng.choice(['UTG', 'HJ', 'CO'])
    open_to = rng.choice([2.5, 3.0, 3.5, 4.0])
    hero_pos = rng.choice(['SB', 'BB', 'BTN'])
    call = {'SB': open_to - 0.5, 'BB': open_to - 1.0, 'BTN': open_to}[hero_pos]

    deep = rng.random() < 0.5
    ratio = rng.choice([20, 25, 30, 40] if deep else [4, 5, 6, 8])
    # Snap stacks to a clean 5BB grid; the deep/shallow zones are wide enough
    # that snapping never crosses the 15-20x rule-of-thumb boundary.
    stack = max(10, int(round(call * ratio / 5)) * 5)
    actual_ratio = stack / call
    ratio_str = _fmt(round(actual_ratio, 1))

    pair = rng.choice('234567')
    suits = rng.sample(_SUITS, 2)
    hole = [pair + suits[0], pair + suits[1]]
    pot = open_to + 1.5

    yes_right = 'Yes, call — the effective stacks are deep enough relative to the call to set-mine profitably.'
    yes_wrong = 'Yes, call — you are getting the direct pot odds needed to flop a set.'
    no_right = 'No, fold — the stacks are too shallow to win enough when you hit your set.'
    no_wrong = 'No, fold — small pocket pairs should never be played against a raise.'
    options = [yes_right, yes_wrong, no_right, no_wrong]
    rng.shuffle(options)
    correct_answer = yes_right if deep else no_right

    hero_place = (
        'on the Button' if hero_pos == 'BTN'
        else f"in the {preflop_charts.POSITION_NAMES[hero_pos]}"
    )
    if deep:
        verdict = (
            f"With {stack}BB effective — about {ratio_str}x the price of the call, "
            f"comfortably above the 15-20x rule of thumb — you win enough on "
            f"set-over-pair and set-versus-overpair situations to cover all the "
            f"times you miss and fold. Calling is profitable."
        )
    else:
        verdict = (
            f"With only {stack}BB effective — about {ratio_str}x the price of the "
            f"call, far below the 15-20x rule of thumb — the times you flop a set "
            f"cannot win enough to pay for the ~88% of flops you miss. Folding "
            f"is correct."
        )
    return {
        'id': build_scenario_id('implied_odds', seed),
        'skill': 'implied_odds',
        'title': f"Set Mining: {pair}{pair} vs a {villain_pos} Raise",
        'description': (
            f"6-max cash game, {stack}BB effective stacks. {villain_pos} raises "
            f"to {_fmt(open_to)}BB. Action folds to you {hero_place} holding "
            f"{_pretty_hand(hole)}. Do you have the implied odds to call and set mine?"
        ),
        'hole_cards': hole,
        'board': [],
        'position': hero_pos,
        'pot_size_bb': pot,
        'stack_size_bb': stack,
        'villain_action': f"{villain_pos} raises to {_fmt(open_to)}BB",
        'question': 'Is calling profitable based on implied odds?',
        'options': options,
        'correct_answer': correct_answer,
        'explanation': (
            f"Calling costs {_fmt(call)}BB more. You flop a set roughly 12% of the "
            f"time (about 7.5:1 against), so the direct pot odds "
            f"({_fmt(pot)}:{_fmt(call)}) never justify calling on their own — the "
            f"call must be funded by implied odds. {verdict}"
        ),
        'ev_notes': (
            'Set-mining rule of thumb: effective stacks should be at least '
            '15-20x the price of the call.'
        ),
        'question_type': 'concept',
        'meta': {'deep': deep, 'call_bb': call, 'stack_bb': stack},
    }


# --------------------------------------------------------------------------- #
# skill: preflop_range
# --------------------------------------------------------------------------- #
def generate_preflop_range(seed: int) -> dict:
    """Raise-first-in decision: open or fold, judged against the RFI charts."""
    rng = random.Random(f"preflop_range:{VERSION}:{seed}")

    position = rng.choice(['UTG', 'HJ', 'CO', 'BTN'])
    if rng.random() < 0.6:
        # Concentrate on the chart boundary, where the real learning happens.
        boundary = preflop_charts.BOUNDARY_HANDS[position]
        klass = rng.choice(boundary['in'] + boundary['out'])
    else:
        klass = rng.choice(preflop_charts.ALL_HAND_CLASSES)

    if len(klass) == 2:  # pair
        s1, s2 = rng.sample(_SUITS, 2)
        hole = [klass[0] + s1, klass[1] + s2]
    elif klass[2] == 's':
        suit = rng.choice(_SUITS)
        hole = [klass[0] + suit, klass[1] + suit]
    else:
        s1, s2 = rng.sample(_SUITS, 2)
        hole = [klass[0] + s1, klass[1] + s2]

    in_range = preflop_charts.is_in_opening_range(position, klass)
    open_size = preflop_charts.OPEN_RAISE_SIZE_BB
    raise_option = f"Raise to {_fmt(open_size)}BB"
    options = ['Fold', 'Call 1BB (limp)', raise_option, 'Raise to 10BB']
    correct_answer = raise_option if in_range else 'Fold'

    pos_name = preflop_charts.POSITION_NAMES[position]
    seat_phrase = 'on the Button' if position == 'BTN' else f'in the {pos_name}'
    range_pct = round(preflop_charts.range_fraction(position) * 100)
    if in_range:
        explanation = (
            f"{klass} is inside the simplified {pos_name} opening range (roughly "
            f"the top {range_pct}% of hands). When the action folds to you, "
            f"open-raising to about {_fmt(open_size)}BB is the standard play: it "
            f"attacks the blinds with a playable hand and keeps the initiative. "
            f"Open-limping is not part of a sound baseline strategy, and a 10BB "
            f"open risks far too much to win 1.5BB."
        )
        ev_notes = 'Open-raising every in-range hand pressures the blinds and keeps your range unexploitable.'
    else:
        explanation = (
            f"{klass} falls outside the simplified {pos_name} opening range "
            f"(roughly the top {range_pct}% of hands), so it is a fold. Playing "
            f"below-range hands invites domination and tough postflop spots. "
            f"Open-limping is not part of a sound baseline strategy, and raising "
            f"a hand this far below the range threshold burns money."
        )
        ev_notes = 'Opening below-range hands loses EV against competent defenders; preflop discipline compounds on every later street.'

    return {
        'id': build_scenario_id('preflop_range', seed),
        'skill': 'preflop_range',
        'title': f"Preflop: {klass} from {position}",
        'description': (
            f"6-max cash game, 100BB effective stacks. You are dealt "
            f"{_pretty_hand(hole)} {seat_phrase} ({position}). Action folds "
            f"to you. What should you do?"
        ),
        'hole_cards': hole,
        'board': [],
        'position': position,
        'pot_size_bb': 1.5,
        'stack_size_bb': 100,
        'villain_action': None,
        'question': 'What is the correct action?',
        'options': options,
        'correct_answer': correct_answer,
        'explanation': explanation,
        'ev_notes': ev_notes,
        'question_type': 'action',
        'meta': {'hand_class': klass, 'in_range': in_range},
    }


# Registry of seed -> scenario generators, keyed by BKT skill. Skills absent
# here simply have no infinite-mode support yet; adding one is purely additive.
GENERATORS = {
    'preflop_range': generate_preflop_range,
    'equity_estimation': generate_equity_estimation,
    'pot_odds': generate_pot_odds,
    'implied_odds': generate_implied_odds,
    'mdf': generate_mdf,
}
