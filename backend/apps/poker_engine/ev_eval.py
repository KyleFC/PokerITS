"""Expected-value (EV) evaluation and the EV-loss -> BKT observation policy.

This module turns a concrete player decision into two things:

  1. An **EV loss in big blinds** — how much worse the chosen action is than
     the best available one, measured with closed-form / combinatorial math
     (never a live solver, per project.md §1).
  2. A **binary correct/incorrect observation** for a specific BKT skill,
     produced by the explicit, documented policy in ``EV_LOSS_THRESHOLDS``.

Why the policy lives here, written down and unit-tested (project.md §5):
BKT consumes binary observations, but live-hand EV loss is continuous. An
implicit or drifting mapping reintroduces the exact "I lost the hand, so I
played it wrong" cognitive dissonance the whole architecture exists to prevent.
So the conversion is a single, visible table — not a magic number buried in a
view — and every skill's threshold is justified in a comment.

Sign convention: EV loss is always ``>= 0``. 0 means the chosen action was the
(or a) best action; a positive value is how many big blinds of EV were given up.

Two families of decision are scored:

* **Preflop (``preflop_range``)** — graded by *deviation from the static RFI /
  heads-up charts*, not solved EV (project.md §3b). A chart-correct action is a
  0-loss; a deviation is charged a fixed nominal penalty so it crosses the
  incorrect threshold. The penalty is a *severity marker*, not a solved figure.
* **Postflop facing a bet (``pot_odds`` / ``mdf`` / ``equity_estimation`` /
  ``implied_odds``)** — graded by real closed-form EV: given the price and the
  hero's equity, calling has a computable EV and folding is worth 0, so the EV
  loss of the chosen action is exact.
"""
from apps.poker_engine import preflop_charts


# --------------------------------------------------------------------------- #
# EV-loss -> binary-observation policy  (project.md §5 — the critical mapping)
# --------------------------------------------------------------------------- #
# A decision whose EV loss is at or below its skill's threshold (BB) is recorded
# as a CORRECT observation; anything above it is INCORRECT. Thresholds encode
# how much imprecision is pedagogically acceptable for each skill before we flag
# a genuine leak.
EV_LOSS_THRESHOLDS = {
    # Preflop is scored as pure chart deviation: correct = 0.0 loss, any
    # deviation = PREFLOP_DEVIATION_PENALTY_BB (> 0). A zero tolerance turns
    # "off-chart" straight into an incorrect observation.
    'preflop_range': 0.0,
    # Pot odds / MDF are exact bet-sizing math. Half a big blind of slack
    # forgives rounding and near-break-even spots while still catching a
    # clearly-wrong call or fold.
    'pot_odds': 0.5,
    'mdf': 0.5,
    # Equity misjudgement shows up as an EV-losing call/fold; same tolerance.
    'equity_estimation': 0.5,
    # Implied-odds (set-mining) pots swing larger, so a wider band avoids
    # penalising thin-but-defensible calls.
    'implied_odds': 1.0,
}

# Fixed EV-loss charged to a preflop chart deviation. Any value strictly above
# the ``preflop_range`` threshold (0.0) works; 1.0 BB reads as a meaningful
# preflop mistake without implying a solved figure.
PREFLOP_DEVIATION_PENALTY_BB = 1.0


def ev_loss_is_correct(skill: str, ev_loss_bb: float) -> bool:
    """Apply the policy: is an EV loss small enough to count as a correct play?

    Raises KeyError for an unknown skill rather than silently defaulting — a
    missing threshold is a bug we want surfaced, not smoothed over.
    """
    return ev_loss_bb <= EV_LOSS_THRESHOLDS[skill]


# --------------------------------------------------------------------------- #
# Closed-form postflop EV (facing a bet)
# --------------------------------------------------------------------------- #
def required_equity(pot_before_call: float, bet_to_call: float) -> float:
    """Break-even calling equity = call / (pot after the call).

    ``pot_before_call`` is the pot the caller stands to win *including* the
    villain's bet but *excluding* the hero's own call. Matches the pot-odds
    definition used by the scenario generators.
    """
    return bet_to_call / (pot_before_call + bet_to_call)


def call_ev_bb(equity: float, pot_before_call: float, bet_to_call: float) -> float:
    """EV (in BB) of calling a bet, relative to folding (which is 0 EV).

    Win  -> gain the pot that is already out there (``pot_before_call``).
    Lose -> forfeit the ``bet_to_call`` you put in.
    EV = equity * pot_before_call - (1 - equity) * bet_to_call.
    """
    return equity * pot_before_call - (1 - equity) * bet_to_call


def facing_bet_ev_loss(action: str, equity: float, pot_before_call: float,
                       bet_to_call: float) -> float:
    """EV loss (BB) of the hero's response to a bet.

    ``action`` is normalised to a continue/fold decision: 'call', 'raise',
    'check_call' and 'continue' all count as *continuing*; 'fold' as folding.
    (A raise is treated as a continue for defend-frequency purposes; sizing the
    raise optimally is a separate, solver-shaped question out of scope here.)

    The best action is whichever of call/fold has the higher EV, so the loss is
    ``EV(best) - EV(chosen)`` and is always >= 0.
    """
    ev_call = call_ev_bb(equity, pot_before_call, bet_to_call)
    ev_fold = 0.0
    ev_best = max(ev_call, ev_fold)

    continuing = action in ('call', 'raise', 'check_call', 'continue')
    ev_chosen = ev_call if continuing else ev_fold
    return ev_best - ev_chosen


# --------------------------------------------------------------------------- #
# Preflop chart-deviation scoring
# --------------------------------------------------------------------------- #
# Normalised action kinds a hero decision collapses to for chart comparison.
def _action_kind(action: str) -> str:
    a = action.lower()
    if 'fold' in a:
        return 'fold'
    if 'raise' in a or 'bet' in a or 'open' in a or 'shove' in a or 'all-in' in a:
        return 'raise'
    return 'call'  # check/call/limp/continue


def preflop_deviation_ev_loss(hole_cards: list[str], position: str, action: str,
                              *, heads_up: bool = False,
                              facing_open: bool = False) -> float:
    """EV loss for a preflop decision, judged against the chart for the spot.

    ``heads_up=False`` grades a 6-max raise-first-in decision (open vs fold)
    against ``RFI_RANGES``. ``heads_up=True`` grades a heads-up spot against the
    HU charts: the SB/Button open (``facing_open=False``) or the BB defend
    (``facing_open=True``, where continuing = call or 3-bet).

    Returns 0.0 when the action matches the chart, else
    ``PREFLOP_DEVIATION_PENALTY_BB``.
    """
    klass = preflop_charts.hand_class(hole_cards[0], hole_cards[1])
    kind = _action_kind(action)

    if heads_up and facing_open:
        should_continue = preflop_charts.is_hu_defend(klass)
        chose_continue = kind in ('raise', 'call')
        correct = chose_continue == should_continue
    else:
        in_range = (
            preflop_charts.is_hu_open(klass) if heads_up
            else preflop_charts.is_in_opening_range(position, klass)
        )
        # Raise-first-in: the chart-correct action is raise if in range, else
        # fold. Limping (kind 'call') is never chart-correct in these
        # pedagogical ranges, so it is graded a deviation for any hand — not
        # silently treated as a fold.
        correct = (kind == 'raise') if in_range else (kind == 'fold')

    return 0.0 if correct else PREFLOP_DEVIATION_PENALTY_BB


# --------------------------------------------------------------------------- #
# Top-level decision evaluator
# --------------------------------------------------------------------------- #
def evaluate_decision_ev(decision: dict, hand_context: dict) -> dict:
    """Score one hero decision: EV loss + the resulting BKT observation.

    ``decision`` describes what the hero did and which skill it exercises::

        {'skill': 'pot_odds', 'action': 'call'}          # postflop
        {'skill': 'preflop_range', 'action': 'raise'}    # preflop

    ``hand_context`` supplies the numbers the skill needs:
      * preflop_range: ``hole_cards``, ``position``, optional ``heads_up`` /
        ``facing_open``.
      * postflop (pot_odds / mdf / equity_estimation / implied_odds):
        ``equity`` (0-1), ``pot_before_call`` (BB), ``bet_to_call`` (BB).

    Returns ``{'skill', 'ev_loss_bb', 'correct'}`` where ``correct`` is the
    binary BKT observation from the documented policy.
    """
    skill = decision['skill']
    action = decision['action']

    if skill == 'preflop_range':
        ev_loss = preflop_deviation_ev_loss(
            hand_context['hole_cards'],
            hand_context.get('position'),
            action,
            heads_up=hand_context.get('heads_up', False),
            facing_open=hand_context.get('facing_open', False),
        )
    elif skill in ('pot_odds', 'mdf', 'equity_estimation', 'implied_odds'):
        ev_loss = facing_bet_ev_loss(
            action,
            hand_context['equity'],
            hand_context['pot_before_call'],
            hand_context['bet_to_call'],
        )
    else:
        raise KeyError(f"No EV evaluation defined for skill: {skill}")

    return {
        'skill': skill,
        'ev_loss_bb': round(ev_loss, 4),
        'correct': ev_loss_is_correct(skill, ev_loss),
    }
