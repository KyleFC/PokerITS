# Gameplay-Embedded Quizzes — Integration Plan

**Date:** July 5, 2026
**Scope:** Current module sprint only. Replace the static quiz card with a scripted hand replay that plays out the lead-up to each scenario's decision point on a rendered poker table, then asks the quiz question in context.
**Audience:** This document is a self-contained work order for the integrating engineer/LLM. Follow the steps in order; each step has a verification gate. Do not skip gates.

---

## ✅ STATUS: IMPLEMENTED (July 5, 2026)

This plan has been fully implemented against **PokerKit 0.7.4**. All backend and frontend gates pass: `pytest` = 98 passed / 6 skipped (skips are action-option checks correctly skipped on concept scenarios), `vitest` = 9 passed, `vite build` clean, and a live HTTP smoke test of the replay endpoint returns correct frames with no answer-key/gameplay leakage.

**Files added/changed:**
- Backend: `apps/poker_engine/replay.py` (new), `apps/poker_engine/views.py` (+`ScenarioReplayView`), `apps/poker_engine/urls.py` (+replay route, ordered before the catch-all), `apps/poker_engine/scenarios.json` (+`question_type`/`gameplay` on all 8), `apps/poker_engine/tests/test_replay.py` (new), `requirements.txt` (+`pokerkit`).
- Frontend: `components/PokerTable.jsx` (new), `components/HandReplayModal.jsx` (new), `components/QuizResultPanel.jsx` (extracted, shared with `QuizModal`), `components/PokerCard.jsx` (+face-down back for `??`), `services/api.js` (+`getScenarioReplay`), `pages/Dashboard.jsx` (uses `HandReplayModal`), `components/__tests__/PokerTable.test.jsx` (new).

**Three deviations from the original draft, forced by the real PokerKit 0.7.4 API (verified empirically, §5.1-style probe):**
1. **Heads-up seat order is reversed vs. the draft.** PokerKit indexes heads-up as **index 0 = BB, index 1 = SB/button** (the button posts the SB and acts first preflop). So HU `seats` are `["BB", "BTN"]`, not `["BTN", "BB"]`. 6-max is `["SB","BB","UTG","HJ","CO","BTN"]` as drafted. Worked example B below still uses the old order — trust `scenarios.json`, not that snippet.
2. **Card stringification.** `repr(card)` → `"[Kd]"` and `str(card)` → `"ACE OF SPADES (As)"`; neither is usable. Cards expose `.rank`/`.suit`, so `replay.py` formats as `f"{c.rank}{c.suit}"` and maps unknown cards to `"??"`. `board_cards` is a list-of-lists and is flattened.
3. **`stack_size_bb` = effective *starting* stack** (`gameplay.stacks[hero]`), not remaining-behind — this avoids the fractional-stack problem when the hero has posted a blind (e.g. SB hero has 99.5 behind). The table always shows live remaining stacks anyway. Additionally, the pot-odds/MDF scenarios were rescaled from dollars to reasonable BB amounts (ratios and answers unchanged) so the table and narration agree.

The step-by-step plan below is retained as the authoritative description of the design and its rationale.

---

## 0. TL;DR

- Adopt **PokerKit** (`pip install pokerkit`, MIT license, Python 3.11+, actively maintained by the University of Toronto Computer Poker Research Group) as the poker state machine. It supports dealing *exact* predetermined hole/board cards ("deck stacking") and scripted betting actions, and it automatically tracks pot, stacks, bets, street transitions, and action legality.
- Each scenario in `scenarios.json` gets a new `gameplay` block: seats, stacks, blinds, fixed hole cards, and a scripted action sequence that ends exactly where the quiz question fires.
- A new pure-Python module `backend/apps/poker_engine/replay.py` runs the script through PokerKit **server-side** and emits a list of display **frames** (snapshots: pot, stacks, bets, board, narration). A new endpoint `GET /api/poker/scenarios/<id>/replay/` returns all frames in one response.
- The frontend gets a new `PokerTable` component and a `HandReplayModal` that animates the frames, pauses at the decision point, and presents either poker action buttons (for action questions) or the question overlay (for concept questions). Answer submission and grading reuse the **existing, unchanged** `POST /api/student/quiz-result/` endpoint.
- No database migrations. No WebSockets. No per-step API calls. Replays are deterministic and stateless.
- The same `replay.py` wrapper becomes the foundation of `game_loop.py` in Module 3 (live play), and the "decision frame" contract is how quizzes will later be injected into live hands.

---

## 1. Goal and Non-Goals

**Goal:** The user clicks a scenario and, instead of reading a wall of text, watches the hand play out — blinds posted, cards dealt, villains acting street by street — until the action reaches the hero at the exact situation the quiz describes. The question is asked there, on the table.

**Non-goals for this sprint:**
- No free-play / full gameplay. The user makes exactly one decision per scenario (the quiz answer). The hand does not continue after the answer.
- No bot AI (`bot_strategy.py` stays stubbed). Villain actions are scripted per scenario.
- No hand persistence (`HandHistory` stays unused). Nothing about a replay needs to be stored.
- No changes to BKT, grading, or the student model.

---

## 2. Open-Source Decision

### 2.1 Backend engine — PokerKit (chosen)

| Library | Verdict | Why |
|---|---|---|
| **[PokerKit](https://github.com/uoftcprg/pokerkit)** (uoftcprg) | ✅ **Use this** | MIT. Python 3.11+ (project uses 3.12.7 ✓). Active (v0.7.4, May 2026; 50+ releases). Published in IEEE Transactions on Games. Fine-grained state control is a first-class feature: deal exact hole cards (`state.deal_hole('AcKc')`), unknown cards (`'????'`), exact board cards (`state.deal_board('Tc8c2d')`), scripted actions (`fold()`, `check_or_call()`, `complete_bet_or_raise_to(n)`), automatic blind posting/pot collection/street transitions via `Automation`, and queryable legality (`can_fold()`, `can_check_or_call()`, `can_complete_bet_or_raise_to(n)`). Raises on illegal actions and duplicate cards — free validation of our scripts. |
| [texasholdem](https://github.com/SirRender00/texasholdem) (SirRender00) | ❌ | Solid hold'em engine with history export, but dealing is deck-driven; injecting exact hole/board cards mid-hand is not a supported first-class operation. Less active. |
| [PyPokerEngine](https://github.com/ishikota/PyPokerEngine) | ❌ | Built for RL bot development; effectively unmaintained; emulator API fights our "exact scripted state" requirement. |
| [pokerlib](https://pypi.org/project/pokerlib/) / [pokerengine](https://pypi.org/project/pokerengine/) | ❌ | Table/room-oriented multiplayer abstractions; more to fight than to reuse. |
| clubs / RLCard | ❌ | Gym-style RL environments; wrong shape for scripted replay. |

**Division of labor:** PokerKit is the *dealer/state machine only*. `treys` stays exactly where it is (`hand_eval.py`, already tested) — no showdown ever happens in a replay, so the two never overlap. This also respects `project.md` §3.

### 2.2 Frontend table — build in-house (no library)

Surveyed: [react-poker](https://github.com/therewillbecode/react-poker) (card animation lib, stale), [poker-table](https://github.com/sergij14/poker-table), [holdem-poker](https://github.com/aaronjosephm/holdem-poker), [poker-replayer](https://github.com/Pablo123GitHub/poker-replayer) — all are abandoned demo apps or CRA-era projects, none is a maintained component library, and none matches the Tailwind design system already in place. The existing `PokerCard.jsx` component already renders cards well. A heads-up/6-max table view is one component (~150 lines of JSX). **Build it.**

---

## 3. Architecture

```
scenarios.json (+ gameplay block)
        │
        ▼
replay.py ── PokerKit NoLimitTexasHoldem state ──► frames[]        (server, at request time)
        │                                                          deterministic, stateless
        ▼
GET /api/poker/scenarios/<id>/replay/  ──►  { scenario, question_type, frames[] }
        │
        ▼
HandReplayModal (React) — animates frames → decision point → user answers
        │
        ▼
POST /api/student/quiz-result/ { scenario_id, answer }             (EXISTING endpoint, unchanged)
        │
        ▼
BKT update + explanation response → feedback panel on the table
```

**Why server-computed frames (design rationale — do not deviate):**
1. **No answer leakage.** The frame builder runs server-side; `correct_answer`/`explanation`/`ev_notes` never enter the payload (same rule `PublicScenarioSerializer` already enforces).
2. **Stateless.** The whole lead-up is deterministic, so one GET returns everything. No in-progress hand state to persist, no session keys, no cache. (This satisfies `project.md` §2 trivially.)
3. **Dumb client.** Every frame carries a full table snapshot. The frontend never computes poker math — it just renders frame N.
4. **Module 3 ready.** Live play later = same frame contract, but frames are produced incrementally by `game_loop.py` + `bot_strategy.py` instead of a script. The quiz-in-live-game feature is "server emits a `decision` frame with a question attached."

**Units convention (important, use everywhere):** The engine runs in integer chips with **1 BB = 100 chips** (SB = 50). All JSON/scenario/frame amounts are in BB as floats (chips ÷ 100). Scenarios whose flavor text uses dollars are interpreted as $1 = 1 BB; display text may keep the `$`.

---

## 4. Scenario Schema Extension

Add to **every** scenario object in `backend/apps/poker_engine/scenarios.json`:

```jsonc
{
  // ... existing fields unchanged ...
  "question_type": "action",        // "action" = options are poker actions (fold/call/raise);
                                    // "concept" = options are numbers/statements (equity %, MDF...)
  "gameplay": {
    "small_blind": 0.5,             // BB units
    "big_blind": 1.0,
    "seats": ["SB", "BB", "UTG", "HJ", "CO", "BTN"],  // index = PokerKit player index; see §5.1
    "hero": "UTG",                  // must equal one of seats[]; must match top-level "position"
    "stacks": { "SB": 100, "BB": 100, "UTG": 100, "HJ": 100, "CO": 100, "BTN": 100 },
    "hole_cards": { "UTG": "7s2d" },   // seats omitted here are dealt "????" (hidden/unknown)
    "script": [
      // Ordered ops applied after blinds are posted and all hole cards are dealt.
      // The script ends at the decision point: the hero must be the next to act.
      { "op": "fold",       "actor": "HJ" },
      { "op": "raise_to",   "actor": "CO", "amount": 2.5 },
      { "op": "check_call", "actor": "BTN" },
      { "op": "board",      "cards": "Tc8c2d" }        // flop; later "board" ops = turn, river
    ],
    // ONLY for question_type "action": maps each quiz option string to a poker op,
    // so tests can verify every option is a legal action at the decision point.
    "action_options": {
      "Fold": { "op": "fold" },
      "Call": { "op": "check_call" },
      "Raise to 2.5BB": { "op": "raise_to", "amount": 2.5 }
    }
  }
}
```

Op reference (the only four ops):

| op | fields | PokerKit call |
|---|---|---|
| `fold` | `actor` | `state.fold()` |
| `check_call` | `actor` | `state.check_or_call()` |
| `raise_to` | `actor`, `amount` (BB, total raise-to size) | `state.complete_bet_or_raise_to(amount*100)` — also used for opening bets |
| `board` | `cards` (e.g. `"Tc8c2d"`, `"4h"`) | `state.deal_board(cards)` |

`actor` is a **cross-check, not a selector**: PokerKit itself decides whose turn it is (`state.actor_index`). The builder must raise `ValueError` if the seat name at `actor_index` ≠ the script's `actor`. This catches mis-ordered scripts immediately instead of producing a silently wrong replay.

### 4.1 `question_type` assignment for the existing 8 scenarios

| id | question_type | note |
|---|---|---|
| preflop_01 | `action` | Fold / Call / Raise are literal actions |
| preflop_02 | `action` | |
| equity_01 | `concept` | question asks for an equity estimate |
| equity_02 | `concept` | |
| pot_odds_01 | `concept` | asks for break-even equity, not an action |
| pot_odds_02 | `concept` | |
| implied_odds_01 | `concept` | options are statements with reasons |
| mdf_01 | `concept` | |

### 4.2 The script is the source of truth for numbers

After authoring a script, the replayed state at the decision point (pot, hero stack, board, hero cards, who acts) **must equal** the scenario's declared fields — the test in §7 enforces this. Where the current JSON numbers cannot be reproduced exactly (some were hand-written loosely), **adjust the scenario's numeric fields (`pot_size_bb`, `stack_size_bb`) and, if needed, the description text to match the script** — never the other way around. Constraint: the pedagogical answer must remain correct. All four pot-odds/MDF answers depend only on the *bet:pot ratio* (e.g. $50 into $100 → 25% regardless of absolute sizes), and equity answers depend only on cards, so this is safe. Do not change `options`, `correct_answer`, or the skill being tested.

### 4.3 Worked example A — trivial preflop spot (`preflop_01`)

Hero UTG is first to act preflop, so there is no lead-up action at all — the script is empty. The replay still shows blinds posting and cards being dealt, which is the point.

```jsonc
"question_type": "action",
"gameplay": {
  "small_blind": 0.5,
  "big_blind": 1.0,
  "seats": ["SB", "BB", "UTG", "HJ", "CO", "BTN"],
  "hero": "UTG",
  "stacks": { "SB": 100, "BB": 100, "UTG": 100, "HJ": 100, "CO": 100, "BTN": 100 },
  "hole_cards": { "UTG": "7s2d" },
  "script": [],
  "action_options": {
    "Fold": { "op": "fold" },
    "Call": { "op": "check_call" },
    "Raise to 2.5BB": { "op": "raise_to", "amount": 2.5 }
  }
}
```
Decision-point state: pot 1.5 BB (✓ matches `pot_size_bb`), hero stack 100 (✓), UTG to act (✓).

### 4.4 Worked example B — multi-street lead-up (`pot_odds_01`)

Target state: river, board Kd Qh 8s 5d 3c, hero in BB as a bluff-catcher, pot $100 before a $50 villain bet, hero stack 80 behind. Heads-up, both start **130 BB** (this makes the numbers land exactly).

```jsonc
"question_type": "concept",
"gameplay": {
  "small_blind": 0.5,
  "big_blind": 1.0,
  "seats": ["BTN", "BB"],          // heads-up: index 0 posts SB and is the button — verify per §5.1
  "hero": "BB",
  "stacks": { "BTN": 130, "BB": 130 },
  "hole_cards": { "BB": "As2s" },
  "script": [
    { "op": "raise_to",   "actor": "BTN", "amount": 10 },
    { "op": "check_call", "actor": "BB" },                  // pot 20
    { "op": "board",      "cards": "KdQh8s" },
    { "op": "check_call", "actor": "BB" },                  // check
    { "op": "raise_to",   "actor": "BTN", "amount": 15 },   // bet 15
    { "op": "check_call", "actor": "BB" },                  // pot 50
    { "op": "board",      "cards": "5d" },
    { "op": "check_call", "actor": "BB" },                  // check
    { "op": "raise_to",   "actor": "BTN", "amount": 25 },   // bet 25
    { "op": "check_call", "actor": "BB" },                  // pot 100
    { "op": "board",      "cards": "3c" },
    { "op": "check_call", "actor": "BB" },                  // check
    { "op": "raise_to",   "actor": "BTN", "amount": 50 }    // villain bets 50 → hero to act. STOP.
  ]
}
```
Decision-point state: pot 150 BB total including the live bet (✓ `pot_size_bb` 150), hero stack 130 − 10 − 15 − 25 = 80 (✓ `stack_size_bb` 80), board matches, BB to act (✓).

Note: `check_call` when there is no outstanding bet is a **check** — PokerKit's `check_or_call()` handles both; the frame narration should say "checks" when the call amount is 0.

Author the remaining six scripts the same way. Preflop scenarios (preflop_02, implied_odds_01) are blinds + folds + one raise. Postflop concept scenarios (equity_01, equity_02, pot_odds_02, mdf_01) need 1–3 streets of scripted betting sized so the declared pot is reproduced (rescale stacks/fields per §4.2 where necessary).

---

## 5. Backend Implementation

### Step B1 — dependency

Add to `backend/requirements.txt`:
```
pokerkit>=0.7,<0.9
```
Gate: `pip install -r requirements.txt` succeeds; `python -c "import pokerkit; print(pokerkit.__version__)"` prints ≥ 0.7.

### 5.1 Step B2 — seat-order verification (do this BEFORE writing replay.py)

PokerKit orders players by blind position: **index 0 posts the small blind, index 1 the big blind, and the last index is the button** (heads-up: index 0 posts the SB and is also the button, and acts first preflop; the BB acts first postflop). Verify this against the installed version with a scratch script before proceeding — the whole `seats` convention in §4 depends on it:

```python
from pokerkit import Automation, NoLimitTexasHoldem
state = NoLimitTexasHoldem.create_state(
    (Automation.ANTE_POSTING, Automation.BET_COLLECTION, Automation.BLIND_OR_STRADDLE_POSTING,
     Automation.CARD_BURNING, Automation.HOLE_CARDS_SHOWING_OR_MUCKING, Automation.HAND_KILLING,
     Automation.CHIPS_PUSHING, Automation.CHIPS_PULLING),
    True,       # ante_trimming_status (irrelevant, no antes)
    0,          # antes
    (50, 100),  # blinds: index 0 → SB, index 1 → BB
    100,        # min bet
    (13000, 13000),
    2,          # player_count
)
state.deal_hole('????'); state.deal_hole('As2s')
print(state.bets)         # expect [50, 100] → player 0 posted SB
print(state.actor_index)  # expect 0 → SB/button acts first preflop heads-up
```
Gate: printed values confirm the convention (adjust §4 `seats` comments if the installed version differs).

### Step B3 — `backend/apps/poker_engine/replay.py` (new file)

Pure module: no ORM, no Django imports. Public API: `build_replay(scenario: dict) -> dict`. Raises `ReplayError` (define it here, subclass `ValueError`) on any script/state inconsistency.

Reference implementation core (complete the TODOs mechanically; keep the structure):

```python
"""Scripted hand replay builder.

Runs a scenario's `gameplay` script through a PokerKit NLHE state and emits
display frames for the frontend. Deterministic and stateless: same scenario
in, same frames out. Engine units: 1 BB = 100 chips (ints); frames are BB floats.
"""
from pokerkit import Automation, NoLimitTexasHoldem

CHIPS_PER_BB = 100

AUTOMATIONS = (
    Automation.ANTE_POSTING, Automation.BET_COLLECTION,
    Automation.BLIND_OR_STRADDLE_POSTING, Automation.CARD_BURNING,
    Automation.HOLE_CARDS_SHOWING_OR_MUCKING, Automation.HAND_KILLING,
    Automation.CHIPS_PUSHING, Automation.CHIPS_PULLING,
)

STREET_NAMES = {0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river'}  # keyed by board length


class ReplayError(ValueError):
    pass


def _bb(chips):
    return chips / CHIPS_PER_BB


def _snapshot(state, seats, hero_index, kind, narration, actor=None, action=None):
    """Full table snapshot after an operation. Frontend renders this verbatim."""
    board = [repr(c) for c in state.board_cards]          # e.g. ['Tc', '8c', '2d']
    return {
        'kind': kind,                                     # blinds|hole_cards|action|street|decision
        'street': STREET_NAMES[len(board)],
        'narration': narration,
        'actor': actor,
        'action': action,                                 # {'type': ..., 'amount_bb': ...} | None
        'board': board,
        'hero_cards': [repr(c) for c in state.hole_cards[hero_index]],
        'pot_bb': _bb(state.total_pot_amount),            # see §8 pitfall on outstanding bets
        'bets_bb': {seats[i]: _bb(b) for i, b in enumerate(state.bets)},
        'stacks_bb': {seats[i]: _bb(s) for i, s in enumerate(state.stacks)},
        'folded': [seats[i] for i, st in enumerate(state.statuses) if not st],
    }


def build_replay(scenario: dict) -> dict:
    gp = scenario.get('gameplay')
    if not gp:
        raise ReplayError(f"scenario {scenario.get('id')} has no gameplay block")

    seats = gp['seats']
    hero = gp['hero']
    hero_index = seats.index(hero)
    blinds = (int(gp['small_blind'] * CHIPS_PER_BB), int(gp['big_blind'] * CHIPS_PER_BB))
    stacks = tuple(int(gp['stacks'][name] * CHIPS_PER_BB) for name in seats)

    state = NoLimitTexasHoldem.create_state(
        AUTOMATIONS, True, 0, blinds, blinds[1], stacks, len(seats),
    )

    frames = []
    frames.append(_snapshot(state, seats, hero_index, 'blinds',
                            f"Blinds posted: SB {gp['small_blind']} BB, BB {gp['big_blind']} BB"))

    # Deal all hole cards in PokerKit's dealing order; scripted seats get their
    # exact cards, everyone else gets unknown cards ('????' renders as card backs).
    while state.can_deal_hole():
        dealee = seats[state.hole_dealee_index]
        state.deal_hole(gp.get('hole_cards', {}).get(dealee, '????'))
    frames.append(_snapshot(state, seats, hero_index, 'hole_cards',
                            f"You are dealt your hand in the {hero} seat"))

    for step in gp['script']:
        op = step['op']
        if op == 'board':
            if not state.can_deal_board():
                raise ReplayError(f"'board' op while betting round still open: {step}")
            state.deal_board(step['cards'])
            frames.append(_snapshot(state, seats, hero_index, 'street',
                                    f"{STREET_NAMES[len(state.board_cards)].capitalize()} dealt"))
            continue

        actor = seats[state.actor_index]
        if actor != step.get('actor'):
            raise ReplayError(f"script expects {step.get('actor')} to act but {actor} is in turn: {step}")

        if op == 'fold':
            state.fold()
            narration, action = f"{actor} folds", {'type': 'fold'}
        elif op == 'check_call':
            amount = state.checking_or_calling_amount
            state.check_or_call()
            if amount:
                narration, action = f"{actor} calls {_bb(amount)} BB", {'type': 'call', 'amount_bb': _bb(amount)}
            else:
                narration, action = f"{actor} checks", {'type': 'check'}
        elif op == 'raise_to':
            chips = int(step['amount'] * CHIPS_PER_BB)
            verb = 'bets' if not any(state.bets) else 'raises to'
            state.complete_bet_or_raise_to(chips)
            narration, action = f"{actor} {verb} {step['amount']} BB", {'type': 'raise_to', 'amount_bb': step['amount']}
        else:
            raise ReplayError(f"unknown op: {op}")
        frames.append(_snapshot(state, seats, hero_index, 'action', narration, actor, action))

    # Decision point: hero must be in turn.
    if state.actor_index is None or seats[state.actor_index] != hero:
        raise ReplayError(f"script does not end on hero's turn (scenario {scenario.get('id')})")

    legal = []
    if state.can_fold():
        legal.append({'type': 'fold'})
    if state.can_check_or_call():
        amt = state.checking_or_calling_amount
        legal.append({'type': 'call' if amt else 'check', 'amount_bb': _bb(amt)})
    if state.can_complete_bet_or_raise_to():
        legal.append({
            'type': 'raise_to',
            'min_bb': _bb(state.min_completion_betting_or_raising_to_amount),
            'max_bb': _bb(state.max_completion_betting_or_raising_to_amount),
        })
    decision = _snapshot(state, seats, hero_index, 'decision', 'Your turn — what do you do?')
    decision['legal_actions'] = legal
    frames.append(decision)

    return {'frames': frames, 'hero': hero, 'seats': seats,
            'question_type': scenario.get('question_type', 'concept')}
```

Notes for the implementer:
- `repr(card)` formatting: verify a PokerKit `Card` reprs as `'Tc'`-style rank+suit; if not, format via its `rank` and `suit` attributes. Gate B2's scratch script is the place to check.
- If `state.total_pot_amount` turns out **not** to include outstanding bets in the installed version, change `pot_bb` to `_bb(state.total_pot_amount) + sum of bets`. Decide once, assert it in the tests (§7), and note it in a comment.

Gate: `python -c` snippet building the replay for worked example B prints a decision frame with `pot_bb == 150.0` and `stacks_bb['BB'] == 80.0`.

### Step B4 — endpoint

`backend/apps/poker_engine/views.py` — add:

```python
class ScenarioReplayView(views.APIView):
    permission_classes = (permissions.AllowAny,)   # same policy as ScenarioListView

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)
        if not scenario.get('gameplay'):
            return Response({"detail": "Scenario has no gameplay script."}, status=status.HTTP_404_NOT_FOUND)
        replay = build_replay(scenario)
        replay['scenario'] = PublicScenarioSerializer(scenario).data
        return Response(replay, status=status.HTTP_200_OK)
```

Wire in `backend/apps/poker_engine/urls.py`: `path('scenarios/<str:scenario_id>/replay/', ScenarioReplayView.as_view())`.

**Leakage check (mandatory):** the response must contain no `correct_answer`, `explanation`, `ev_notes`, and no villain hole cards other than `'??'` placeholders. `PublicScenarioSerializer` already strips the answer key from the `scenario` sub-object; the `gameplay` block itself must NOT be serialized into the response (it is server-side input only — note `action_options` keys would reveal nothing, but villain scripting plus future fields might; keep it out entirely).

Gate: `curl http://localhost:8000/api/poker/scenarios/pot_odds_01/replay/` returns frames; `grep`-ing the response for `correct_answer` and `explanation` finds nothing.

### Step B5 — author the `gameplay` blocks for all 8 scenarios

Follow §4.2–§4.4. Update numeric scenario fields from the scripts where they disagree. Add `question_type` per §4.1.

Gate: the §7 test suite passes for all 8 scenarios.

---

## 6. Frontend Implementation

### Step F1 — API binding

`frontend/src/services/api.js`, inside `pokerService`:
```js
getScenarioReplay: async (id) => {
  const response = await api.get(`/poker/scenarios/${id}/replay/`);
  return response.data;
},
```

### Step F2 — `frontend/src/components/PokerTable.jsx` (new)

Pure presentational component. Props: `{ frame, seats, hero }`. Renders one frame — no poker logic, no state math:
- Oval felt table (Tailwind: rounded-full/ellipse div, dark green/slate gradient, matches existing dark theme).
- Seat pods around the ellipse: seat name (position label), stack (`stacks_bb`), current bet chip (`bets_bb`) in front of each seat, dimmed/greyed when in `frame.folded`. Hero seat fixed at bottom center.
- Hero's hole cards face-up using the existing `PokerCard` component; other seats show two card-back rectangles (render card backs for any card string containing `'?'`).
- Community cards (`frame.board`) centered, via `PokerCard`.
- Pot display (`frame.pot_bb`) above the board.
- A narration ticker (single line, `frame.narration`).

### Step F3 — `frontend/src/components/HandReplayModal.jsx` (new)

Same modal shell/styling as `QuizModal.jsx` (copy the container, header, footer patterns) but the body is the `PokerTable` plus replay logic:

State machine:
1. On mount: `pokerService.getScenarioReplay(scenario.id)`; on failure fall back to rendering the existing `QuizModal` content (see F4).
2. **Playback:** show frame 0; advance one frame every ~1100 ms (`setInterval` or chained `setTimeout`; clear on unmount). Controls: `⏭ Skip to decision` (jump to last frame), `▶︎/❚❚` pause, and after the decision is reached a `↺ Replay hand` button that restarts from frame 0 without refetching.
3. **Decision point** (last frame, `kind === 'decision'`):
   - `question_type === 'action'`: render the scenario's `options` as a poker action bar under the table (Fold red, Call/Check slate, Raise indigo — button label = the exact option string, since that string is what the grading endpoint expects).
   - `question_type === 'concept'`: dim the table slightly and overlay a question panel: `scenario.question` + option buttons (reuse the option-button styling from `QuizModal`).
4. **Submit:** `studentService.submitQuizResult(scenario.id, selectedOption)` — unchanged endpoint.
5. **Feedback:** reuse `QuizModal`'s result panel verbatim (correct/incorrect chip, correct answer highlight, `explanation`, `ev_notes`) rendered below/over the table; `Continue` calls `onCompleted`.

Do not duplicate grading/feedback logic — extract the result panel from `QuizModal.jsx` into a small shared component (e.g. `QuizResultPanel.jsx`) used by both modals.

### Step F4 — Dashboard wiring with graceful fallback

`frontend/src/pages/Dashboard.jsx`: when a scenario is started, open `HandReplayModal`. Inside it, if the replay fetch 404s (scenario without a `gameplay` block) or errors, render the classic `QuizModal` flow instead. This keeps the app fully working while scripts are being authored one by one.

Gate: `npm run dev` + manual click-through of `preflop_01` (action flow) and `pot_odds_01` (concept flow): blinds → deal → actions animate → decision → answer → feedback → dashboard skill bars refresh.

---

## 7. Tests (the contract that keeps a weaker integrator honest)

### `backend/apps/poker_engine/tests/test_replay.py` (new)

For **every** scenario in the bank (parametrize over `load_scenarios()`):

1. `gameplay` block and `question_type` exist and are well-formed (seats unique, hero in seats, stacks cover all seats).
2. `build_replay(scenario)` runs without `ReplayError` (this alone proves every scripted action is legal poker — PokerKit raises otherwise — and that no card is dealt twice).
3. Decision frame consistency against the scenario's declared fields (exact, tolerance 0.01 for floats):
   - `frames[-1].kind == 'decision'`
   - `frames[-1].board == scenario.board`
   - `frames[-1].hero_cards == scenario.hole_cards`
   - `frames[-1].pot_bb == scenario.pot_size_bb`
   - `frames[-1].stacks_bb[hero] == scenario.stack_size_bb`
   - `gameplay.hero == scenario.position` (treat `position: "IP"` in mdf_01 as a field to correct to a real seat name per §4.2)
4. If `question_type == 'action'`: `action_options` keys == `options` exactly, and each mapped op is legal in the decision frame (`fold` → a `fold` in `legal_actions`; `check_call` → `check`/`call`; `raise_to` amount within `[min_bb, max_bb]`).
5. Determinism: two `build_replay` calls return equal frame lists.
6. Leakage: `json.dumps(build_replay(s))` contains no `correct_answer` / `explanation` / `ev_notes` values, and the only hole cards revealed are the hero's.

Plus one endpoint test (DRF test client): 200 with frames for a scripted scenario, 404 for unknown id.

### Frontend
Add a Vitest test for `PokerTable` (renders pot, seats, folded dimming from a fixture frame) mirroring the existing `__tests__` style. Playback timing logic can stay untested this sprint.

Gate (final): `pytest -v` fully green, `npm test` green, manual click-through per F4.

---

## 8. Pitfalls / Guardrails

- **Do not** add Django Channels/WebSockets, per `project.md` §2. This design needs neither.
- **No migrations.** Nothing in this sprint touches models. If you think you need a migration, re-read §3.
- **Do not** send `gameplay` (scripts, villain cards) to the client; send only `frames`.
- **Do not** trust or compute grading client-side; the existing quiz-result endpoint is the only grader.
- **Units:** every amount crossing the PokerKit boundary is `int` chips (×100); every amount in JSON/frames is BB `float`. Mixing these is the most likely silent bug — the §7 pot/stack equality tests are what catch it.
- **Seat order:** confirm PokerKit's blind/seat indexing once (§5.1) before authoring scripts.
- `treys` stays. PokerKit replaces nothing existing; it only powers `replay.py`.
- Villain unknown cards are `'????'`; render any `'?'` card as a card back.
- mdf_01's `position: "IP"` is not a seat — change it to `BTN` (in position on the river) when authoring its script.
- Keep `build_replay` pure (no ORM/IO) so Module 3 can reuse it and tests stay fast.

## 9. Module 3 Forward-Compatibility (context, not tasks)

- `game_loop.py` should be implemented later as the *interactive* twin of `replay.py`: same PokerKit state construction, same frame snapshots, but actions arrive from the API (hero) and `bot_strategy.py` (villain), with state persisted per `project.md` §2. Frames and the `decision` contract defined here are the shared interface.
- Quiz-during-live-play (the stated end goal) = the live loop emitting a `decision` frame with an attached question at trigger points chosen by the student model. The frontend built this sprint (`PokerTable` + decision overlay) already renders that case.

## 10. Ordered Task Checklist

- [ ] B1 Add `pokerkit` to requirements, install, import-check
- [ ] B2 Seat-order/API scratch verification (§5.1)
- [ ] B3 `replay.py` with `build_replay` + `ReplayError`
- [ ] B4 `ScenarioReplayView` + URL + leakage check
- [ ] B5 Author `gameplay` + `question_type` for all 8 scenarios (worked examples §4.3/§4.4 first — they are pre-authored)
- [ ] T1 `test_replay.py` (write alongside B5; run per scenario as authored)
- [ ] F1 `pokerService.getScenarioReplay`
- [ ] F2 `PokerTable.jsx`
- [ ] F3 `HandReplayModal.jsx` + shared `QuizResultPanel.jsx` extraction
- [ ] F4 Dashboard wiring + fallback to `QuizModal`
- [ ] T2 Vitest `PokerTable` test
- [ ] Final gate: full `pytest -v`, `npm test`, manual click-through of one action and one concept scenario
