"""Mixed-frequency preflop charts — the "advanced tier" source of truth.

Per-hand action frequencies estimated by eye from GTO Wizard 6-max NL25 100BB
solutions (2.5BB opens, SB 3.5BB, "with cold calls 2.5x"), quantized to ~5%.
These are human transcriptions of solver output, NOT solver output itself —
treat every number as ±10 percentage points.

Two consumers:
  * preflop_charts derives its binary ("simple tier") RFI charts from these by
    rounding each hand to its majority action, so the two tiers can never
    disagree about which side of the line a hand is on.
  * The frontend range-viewer's advanced mode displays these ratios directly
    and grades the student's slider answer against them (with leeway).

Encoding: hands absent from a chart fold 100%. RFI positions store just the
open-raise frequency (the solver never flats or jams these spots at meaningful
frequency, matching the 0%-allin sims). The SB chart stores (raise, call)
because the small blind mixes opens with limps; fold = 1 - raise - call.
"""

# Raise-first-in frequency per hand class, UTG through BTN.
RFI_MIXED = {
    'UTG': {
        # Pairs
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0, '99': 1.0,
        '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0, '44': 0.5, '33': 0.35,
        '22': 0.1,
        # Suited aces
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 0.75,
        # Suited kings / queens / jacks / tens
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0, 'K7s': 0.65,
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 0.85,
        'JTs': 1.0, 'J9s': 1.0,
        'T9s': 1.0, 'T8s': 0.6,
        # Suited connectors
        '98s': 0.4, '87s': 0.2, '76s': 0.3, '65s': 0.5, '54s': 0.4,
        # Offsuit
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 0.9, 'ATo': 0.85,
        'KQo': 1.0, 'KJo': 0.5, 'QJo': 0.3,
    },
    'HJ': {
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0, '99': 1.0,
        '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0, '44': 0.6, '33': 0.4,
        '22': 0.15,
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 0.9,
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 0.5,
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 0.6,
        'T9s': 1.0, 'T8s': 1.0,
        '98s': 1.0, '97s': 0.5,
        '87s': 0.6, '76s': 0.5, '65s': 0.7, '54s': 0.6,
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0,
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 0.4,
        'QJo': 0.9, 'QTo': 0.3, 'JTo': 0.35,
    },
    'CO': {
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0, '99': 1.0,
        '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0, '44': 1.0, '33': 1.0,
        '22': 0.9,
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 1.0, 'K4s': 1.0, 'K3s': 0.9,
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 1.0,
        'Q6s': 0.75, 'Q5s': 0.25,
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 0.6,
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 1.0,
        '98s': 1.0, '97s': 1.0,
        '87s': 1.0, '86s': 0.7,
        '76s': 1.0, '65s': 0.7, '54s': 0.8,
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 1.0,
        'A8o': 0.15,
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0,
        'QJo': 1.0, 'QTo': 1.0, 'JTo': 1.0,
    },
    'BTN': {
        'AA': 1.0, 'KK': 1.0, 'QQ': 1.0, 'JJ': 1.0, 'TT': 1.0, '99': 1.0,
        '88': 1.0, '77': 1.0, '66': 1.0, '55': 1.0, '44': 1.0, '33': 1.0,
        '22': 1.0,
        'AKs': 1.0, 'AQs': 1.0, 'AJs': 1.0, 'ATs': 1.0, 'A9s': 1.0,
        'A8s': 1.0, 'A7s': 1.0, 'A6s': 1.0, 'A5s': 1.0, 'A4s': 1.0,
        'A3s': 1.0, 'A2s': 1.0,
        'KQs': 1.0, 'KJs': 1.0, 'KTs': 1.0, 'K9s': 1.0, 'K8s': 1.0,
        'K7s': 1.0, 'K6s': 1.0, 'K5s': 1.0, 'K4s': 1.0, 'K3s': 1.0,
        'K2s': 1.0,
        'QJs': 1.0, 'QTs': 1.0, 'Q9s': 1.0, 'Q8s': 1.0, 'Q7s': 1.0,
        'Q6s': 1.0, 'Q5s': 1.0, 'Q4s': 1.0, 'Q3s': 1.0, 'Q2s': 1.0,
        'JTs': 1.0, 'J9s': 1.0, 'J8s': 1.0, 'J7s': 1.0, 'J6s': 1.0,
        'J5s': 1.0, 'J4s': 1.0,
        'T9s': 1.0, 'T8s': 1.0, 'T7s': 1.0, 'T6s': 1.0, 'T5s': 0.35,
        '98s': 1.0, '97s': 1.0, '96s': 1.0, '95s': 0.6,
        '87s': 1.0, '86s': 1.0, '85s': 1.0,
        '76s': 1.0, '75s': 1.0, '74s': 0.15,
        '65s': 1.0, '64s': 0.7,
        '54s': 1.0, '53s': 0.8,
        '43s': 0.4,
        'AKo': 1.0, 'AQo': 1.0, 'AJo': 1.0, 'ATo': 1.0, 'A9o': 1.0,
        'A8o': 1.0, 'A7o': 1.0, 'A6o': 1.0, 'A5o': 1.0, 'A4o': 1.0,
        'A3o': 1.0,
        'KQo': 1.0, 'KJo': 1.0, 'KTo': 1.0, 'K9o': 1.0, 'K8o': 1.0,
        'QJo': 1.0, 'QTo': 1.0, 'Q9o': 1.0,
        'JTo': 1.0, 'J9o': 1.0,
        'T9o': 1.0, 'T8o': 0.7,
        '98o': 0.6,
    },
}

# Small blind opens bigger than the other positions in the source sim.
SB_OPEN_RAISE_SIZE_BB = 3.5

# SB strategy vs the remaining player: hand -> (raise_freq, call_freq).
# fold = 1 - raise - call. The solver limps ("call") a huge chunk of hands
# because the SB closes the preflop action getting a discount.
SB_MIXED = {
    # Pairs
    'AA': (0.60, 0.40), 'KK': (0.70, 0.30), 'QQ': (0.65, 0.35),
    'JJ': (0.60, 0.40), 'TT': (0.55, 0.45), '99': (0.55, 0.45),
    '88': (0.50, 0.50), '77': (0.50, 0.50), '66': (0.45, 0.55),
    '55': (0.45, 0.55), '44': (0.40, 0.60), '33': (0.35, 0.65),
    '22': (0.35, 0.65),
    # Suited aces
    'AKs': (0.55, 0.45), 'AQs': (0.70, 0.30), 'AJs': (0.75, 0.25),
    'ATs': (0.80, 0.20), 'A9s': (0.60, 0.40), 'A8s': (0.45, 0.55),
    'A7s': (0.40, 0.60), 'A6s': (0.35, 0.65), 'A5s': (0.55, 0.45),
    'A4s': (0.45, 0.55), 'A3s': (0.35, 0.65), 'A2s': (0.40, 0.60),
    # Suited kings
    'KQs': (0.60, 0.40), 'KJs': (0.55, 0.45), 'KTs': (0.55, 0.45),
    'K9s': (0.45, 0.55), 'K8s': (0.35, 0.65), 'K7s': (0.35, 0.65),
    'K6s': (0.35, 0.65), 'K5s': (0.35, 0.65), 'K4s': (0.30, 0.70),
    'K3s': (0.30, 0.70), 'K2s': (0.30, 0.70),
    # Suited queens
    'QJs': (0.50, 0.50), 'QTs': (0.50, 0.50), 'Q9s': (0.40, 0.60),
    'Q8s': (0.35, 0.65), 'Q7s': (0.25, 0.75), 'Q6s': (0.30, 0.70),
    'Q5s': (0.30, 0.70), 'Q4s': (0.25, 0.75), 'Q3s': (0.25, 0.75),
    'Q2s': (0.25, 0.75),
    # Suited jacks
    'JTs': (0.45, 0.55), 'J9s': (0.40, 0.60), 'J8s': (0.35, 0.65),
    'J7s': (0.30, 0.70), 'J6s': (0.25, 0.75), 'J5s': (0.25, 0.75),
    'J4s': (0.20, 0.80), 'J3s': (0.20, 0.80), 'J2s': (0.20, 0.80),
    # Suited tens
    'T9s': (0.40, 0.60), 'T8s': (0.35, 0.65), 'T7s': (0.30, 0.70),
    'T6s': (0.30, 0.70), 'T5s': (0.25, 0.75), 'T4s': (0.20, 0.80),
    'T3s': (0.15, 0.85), 'T2s': (0.15, 0.85),
    # Suited nines and below
    '98s': (0.35, 0.65), '97s': (0.30, 0.70), '96s': (0.25, 0.75),
    '95s': (0.20, 0.80), '94s': (0.15, 0.85), '93s': (0.10, 0.90),
    '92s': (0.10, 0.90),
    '87s': (0.30, 0.70), '86s': (0.25, 0.75), '85s': (0.20, 0.80),
    '84s': (0.05, 0.45), '82s': (0.10, 0.90),
    '76s': (0.35, 0.65), '75s': (0.30, 0.70), '74s': (0.15, 0.85),
    '65s': (0.35, 0.65), '64s': (0.20, 0.80), '63s': (0.05, 0.75),
    '54s': (0.35, 0.65), '53s': (0.10, 0.80),
    '43s': (0.15, 0.75),
    # Offsuit aces
    'AKo': (0.60, 0.40), 'AQo': (0.55, 0.45), 'AJo': (0.55, 0.45),
    'ATo': (0.50, 0.50), 'A9o': (0.45, 0.55), 'A8o': (0.35, 0.65),
    'A7o': (0.30, 0.70), 'A6o': (0.25, 0.75), 'A5o': (0.30, 0.70),
    'A4o': (0.25, 0.75), 'A3o': (0.15, 0.85), 'A2o': (0.10, 0.90),
    # Offsuit kings
    'KQo': (0.50, 0.50), 'KJo': (0.45, 0.55), 'KTo': (0.40, 0.60),
    'K9o': (0.30, 0.70), 'K8o': (0.20, 0.80), 'K7o': (0.10, 0.90),
    'K6o': (0.10, 0.90), 'K5o': (0.10, 0.90), 'K4o': (0.05, 0.90),
    'K3o': (0.05, 0.75),
    # Offsuit queens
    'QJo': (0.40, 0.60), 'QTo': (0.35, 0.65), 'Q9o': (0.25, 0.75),
    'Q8o': (0.15, 0.85), 'Q7o': (0.05, 0.90), 'Q6o': (0.05, 0.85),
    'Q5o': (0.05, 0.80),
    # Offsuit jacks and below
    'JTo': (0.35, 0.65), 'J9o': (0.25, 0.75), 'J8o': (0.15, 0.85),
    'J7o': (0.05, 0.85),
    'T9o': (0.30, 0.70), 'T8o': (0.20, 0.80), 'T7o': (0.05, 0.85),
    '98o': (0.20, 0.80), '97o': (0.05, 0.65),
    '87o': (0.05, 0.85), '86o': (0.05, 0.55),
    '76o': (0.05, 0.80),
    '65o': (0.05, 0.70),
    '54o': (0.00, 0.50),
}


def mixed_strategy(position: str, klass: str) -> dict:
    """Full {allin, raise, call, fold} mix for a hand class in a position.

    Frequencies always sum to 1. 'allin' is present because the source sims
    include an open-jam action, but it is 0% everywhere in them — kept so the
    advanced-tier slider UI can grade all four actions uniformly.
    """
    if position == 'SB':
        raise_f, call_f = SB_MIXED.get(klass, (0.0, 0.0))
    else:
        raise_f, call_f = RFI_MIXED[position].get(klass, 0.0), 0.0
    return {
        'allin': 0.0,
        'raise': round(raise_f, 4),
        'call': round(call_f, 4),
        'fold': round(1.0 - raise_f - call_f, 4),
    }


def simple_action(position: str, klass: str) -> str:
    """Round a hand's mix to its majority action ('raise'/'call'/'fold').

    Ties break toward the more aggressive action, so a 50/50 hand is taught
    as a raise — the simple tier deliberately errs on the side of aggression.
    """
    mix = mixed_strategy(position, klass)
    if mix['raise'] >= mix['call'] and mix['raise'] >= mix['fold']:
        return 'raise'
    if mix['call'] >= mix['fold']:
        return 'call'
    return 'fold'
