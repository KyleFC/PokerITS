"""Scripted hand replay builder.

Runs a scenario's ``gameplay`` script through a PokerKit No-Limit Texas
Hold'em state and emits display *frames* for the frontend to animate. The
replay reconstructs the lead-up to a quiz's decision point (blinds, deals,
villain actions) so the learner plays *into* the situation instead of reading
a static prompt.

Deterministic and stateless: the same scenario in produces the same frames
out, so the whole lead-up can be returned in a single request with no
in-progress hand state to persist (see project.md §2).

Engine units: PokerKit runs in integer chips with **1 BB = 100 chips**
(SB = 50). Everything crossing into JSON/frames is converted to BB floats.

Seat ordering follows PokerKit's own indexing, verified against the installed
version (0.7.4):
- 6-max:    index 0=SB, 1=BB, 2=UTG, 3=HJ, 4=CO, 5=BTN.
- heads-up: index 0=BB, index 1=SB/BTN (button posts the small blind and acts
  first preflop; BB acts first postflop).
The scenario's ``seats`` list must be given in this index order.

This module is intentionally pure (no ORM, no Django imports) so it can be
unit-tested in isolation and reused by the live dealer (``game_loop.py``) in
Module 3, which produces the same frame contract from interactive actions.
"""
import warnings

from pokerkit import Automation, NoLimitTexasHoldem

CHIPS_PER_BB = 100

# Automate everything except the hole/board dealing and betting actions, which
# the script drives explicitly. CARD_BURNING is automated, so board cards can be
# dealt directly without a manual burn.
AUTOMATIONS = (
    Automation.ANTE_POSTING,
    Automation.BET_COLLECTION,
    Automation.BLIND_OR_STRADDLE_POSTING,
    Automation.CARD_BURNING,
    Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
    Automation.HAND_KILLING,
    Automation.CHIPS_PUSHING,
    Automation.CHIPS_PULLING,
)

# Street name keyed by the number of board cards dealt so far.
STREET_NAMES = {0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river'}


class ReplayError(ValueError):
    """Raised when a scenario's gameplay script is inconsistent with the state.

    Any inconsistency (wrong actor order, illegal action, script that does not
    end on the hero's turn, malformed gameplay block) is a scenario-authoring
    bug, not a runtime condition to recover from.
    """


def _bb(chips: int) -> float:
    return chips / CHIPS_PER_BB


def _card_str(card) -> str:
    """Format a PokerKit Card as a 'Rank+suit' string (e.g. 'As'), or '??'.

    Unknown cards (dealt as '????' to hidden villains) render as card backs on
    the frontend.
    """
    if getattr(card, 'unknown_status', False):
        return '??'
    return f"{card.rank}{card.suit}"


def _board_strs(state) -> list[str]:
    """Flatten PokerKit's list-of-lists board into ['Tc', '8c', '2d']."""
    return [_card_str(card) for group in state.board_cards for card in group]


def _street_name(state) -> str:
    return STREET_NAMES[len(_board_strs(state))]


def _snapshot(state, seats, hero_index, kind, narration, actor=None, action=None,
              seat_actions=None) -> dict:
    """Full table snapshot after an operation; the frontend renders it verbatim.

    ``seat_actions`` maps each seat to its most recent action badge for the
    current betting round (e.g. 'Fold', 'Call', 'Bet', 'Raise', 'Check'), or
    None if it has not acted. This is what lets the table show, at a glance,
    what every player did — the way Stake and other clients do. Folds persist
    for the whole hand; other badges are cleared at the start of each street by
    the caller.
    """
    return {
        'kind': kind,                       # blinds|hole_cards|action|street|decision
        'street': _street_name(state),
        'narration': narration,
        'actor': actor,                     # seat label of the acting player, or None
        'action': action,                   # {'type': ..., 'amount_bb': ...} | None
        'board': _board_strs(state),
        'hero_cards': [_card_str(c) for c in state.hole_cards[hero_index]],
        'pot_bb': _bb(state.total_pot_amount),   # includes live outstanding bets
        'bets_bb': {seats[i]: _bb(b) for i, b in enumerate(state.bets)},
        'stacks_bb': {seats[i]: _bb(s) for i, s in enumerate(state.stacks)},
        'folded': [seats[i] for i, alive in enumerate(state.statuses) if not alive],
        'seat_actions': dict(seat_actions) if seat_actions else {},
    }


def _validate_gameplay(scenario: dict) -> dict:
    gp = scenario.get('gameplay')
    sid = scenario.get('id')
    if not gp:
        raise ReplayError(f"scenario {sid} has no gameplay block")
    seats = gp.get('seats')
    if not seats or len(set(seats)) != len(seats):
        raise ReplayError(f"scenario {sid} has missing or duplicate seats: {seats}")
    hero = gp.get('hero')
    if hero not in seats:
        raise ReplayError(f"scenario {sid} hero {hero!r} is not one of seats {seats}")
    stacks = gp.get('stacks', {})
    missing = [s for s in seats if s not in stacks]
    if missing:
        raise ReplayError(f"scenario {sid} is missing stacks for {missing}")
    return gp


def build_replay(scenario: dict) -> dict:
    """Build the frame list for a scenario's scripted lead-up.

    Returns ``{'frames': [...], 'hero': str, 'seats': [...],
    'question_type': str}``. The final frame has ``kind == 'decision'`` and a
    ``legal_actions`` list describing what the hero may do.
    """
    gp = _validate_gameplay(scenario)
    seats = gp['seats']
    hero = gp['hero']
    hero_index = seats.index(hero)
    blinds = (int(gp['small_blind'] * CHIPS_PER_BB), int(gp['big_blind'] * CHIPS_PER_BB))
    stacks = tuple(int(gp['stacks'][name] * CHIPS_PER_BB) for name in seats)

    # We deliberately stack the deck: hero cards and board cards are fixed while
    # villain hole cards stay unknown. PokerKit then warns that a specific board
    # card "is not recommended to be dealt" (it cannot prove the card is free
    # because the unknown villain cards might collide). That is exactly the
    # intended scripted-replay behaviour, so silence just that warning.
    warnings.filterwarnings(
        'ignore', message='.*not recommended to be dealt.*', category=UserWarning,
    )

    state = NoLimitTexasHoldem.create_state(
        AUTOMATIONS,
        True,           # ante_trimming_status (no antes, so irrelevant)
        0,              # antes
        blinds,         # (small blind, big blind)
        blinds[1],      # min bet = big blind
        stacks,         # starting stacks, per seat index
        len(seats),     # number of players
    )

    # Per-seat action badge for the current betting round. Folds persist for the
    # whole hand; everything else is cleared when a new street is dealt.
    seat_actions = {name: None for name in seats}

    frames = [_snapshot(
        state, seats, hero_index, 'blinds',
        f"Blinds posted: SB {gp['small_blind']} BB, BB {gp['big_blind']} BB",
        seat_actions=seat_actions,
    )]

    # Deal every player's hole cards in PokerKit's dealing order. Scripted seats
    # receive exact cards; everyone else is dealt unknowns ('????' → card backs).
    hole = gp.get('hole_cards', {})
    while state.can_deal_hole():
        dealee = seats[state.hole_dealee_index]
        state.deal_hole(hole.get(dealee, '????'))
    frames.append(_snapshot(
        state, seats, hero_index, 'hole_cards',
        f"You are dealt your hand in the {hero} seat",
        seat_actions=seat_actions,
    ))

    for step in gp.get('script', []):
        op = step.get('op')

        if op == 'board':
            if not state.can_deal_board():
                raise ReplayError(
                    f"scenario {scenario.get('id')}: 'board' op while a betting "
                    f"round is still open: {step}"
                )
            state.deal_board(step['cards'])
            # New street: clear per-round badges, but keep folds (players are out).
            seat_actions = {
                name: (act if act == 'Fold' else None)
                for name, act in seat_actions.items()
            }
            frames.append(_snapshot(
                state, seats, hero_index, 'street',
                f"{_street_name(state).capitalize()} dealt: "
                f"{' '.join(_board_strs(state))}",
                seat_actions=seat_actions,
            ))
            continue

        actor_index = state.actor_index
        if actor_index is None:
            raise ReplayError(
                f"scenario {scenario.get('id')}: script has action {step} but no "
                f"player is in turn (betting round already closed)"
            )
        actor = seats[actor_index]
        if actor != step.get('actor'):
            raise ReplayError(
                f"scenario {scenario.get('id')}: script expects {step.get('actor')} "
                f"to act but {actor} is in turn: {step}"
            )

        if op == 'fold':
            state.fold()
            narration, action, badge = f"{actor} folds", {'type': 'fold'}, 'Fold'
        elif op == 'check_call':
            amount = state.checking_or_calling_amount
            state.check_or_call()
            if amount:
                narration = f"{actor} calls {_bb(amount)} BB"
                action, badge = {'type': 'call', 'amount_bb': _bb(amount)}, 'Call'
            else:
                narration, action, badge = f"{actor} checks", {'type': 'check'}, 'Check'
        elif op == 'raise_to':
            opening = not any(state.bets)
            verb, badge = ('bets', 'Bet') if opening else ('raises to', 'Raise')
            chips = int(step['amount'] * CHIPS_PER_BB)
            state.complete_bet_or_raise_to(chips)
            narration = f"{actor} {verb} {step['amount']} BB"
            action = {'type': 'raise_to', 'amount_bb': step['amount']}
        else:
            raise ReplayError(f"scenario {scenario.get('id')}: unknown op {op!r}")

        seat_actions[actor] = badge
        frames.append(_snapshot(
            state, seats, hero_index, 'action', narration, actor, action,
            seat_actions=seat_actions,
        ))

    # The script must leave the hero in turn: that is the quiz's decision point.
    if state.actor_index is None or seats[state.actor_index] != hero:
        in_turn = None if state.actor_index is None else seats[state.actor_index]
        raise ReplayError(
            f"scenario {scenario.get('id')}: script does not end on the hero's "
            f"turn (in turn: {in_turn}, hero: {hero})"
        )

    legal_actions = []
    if state.can_fold():
        legal_actions.append({'type': 'fold'})
    if state.can_check_or_call():
        amount = state.checking_or_calling_amount
        if amount:
            legal_actions.append({'type': 'call', 'amount_bb': _bb(amount)})
        else:
            legal_actions.append({'type': 'check'})
    if state.can_complete_bet_or_raise_to():
        legal_actions.append({
            'type': 'raise_to',
            'min_bb': _bb(state.min_completion_betting_or_raising_to_amount),
            'max_bb': _bb(state.max_completion_betting_or_raising_to_amount),
        })

    decision = _snapshot(
        state, seats, hero_index, 'decision', 'Your turn — what do you do?',
        seat_actions=seat_actions,
    )
    decision['legal_actions'] = legal_actions
    frames.append(decision)

    return {
        'frames': frames,
        'hero': hero,
        'seats': seats,
        # Seat holding the dealer button, so the frontend can place the "D" chip.
        'button': 'BTN' if 'BTN' in seats else seats[-1],
        'question_type': scenario.get('question_type', 'concept'),
    }
