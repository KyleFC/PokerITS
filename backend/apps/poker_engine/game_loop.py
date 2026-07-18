"""Synchronous heads-up dealer / game state machine (Module 3a).

Runs a full heads-up No-Limit Hold'em hand against the rule-based bot, preflop
to river, entirely within the request/response cycle — no WebSockets, no push
transport (project.md §2). The hero is the Button/Small Blind (acts first
preflop, in position postflop); the bot is the Big Blind.

**Reconstructable, not stateful.** A hand is fully determined by
``(seed, config, actions)``: the deck is dealt deterministically from the seed
and the betting log is replayed through PokerKit to rebuild the exact state.
Nothing lives in process memory between requests, so in-progress hands survive
worker restarts and work across multiple workers (project.md §2) — the view
persists ``serialize()`` and calls ``restore()`` on the next action.

The frame contract (what the frontend renders) is shared verbatim with
``replay.py`` so the live table and the scripted-replay table are the same
component. Grading of the hero's decisions is delegated to ``ev_eval`` and the
documented EV-loss -> observation policy, keeping the "evaluate the decision,
not the outcome" separation (project.md §1) intact.
"""
import random
import warnings

from pokerkit import NoLimitTexasHoldem

# We deliberately stack the deck (fixed hero/villain/board from a seeded stream),
# so PokerKit warns that a specific card "is not recommended to be dealt" — it
# can't prove the card is free. That is exactly the intended behaviour here, as
# in replay.py, so silence just that warning.
warnings.filterwarnings(
    'ignore', message='.*not recommended to be dealt.*', category=UserWarning,
)

from apps.poker_engine import ev_eval
from apps.poker_engine.bot_strategy import (
    BotProfile, RuleBasedBot, DEFAULT_PROFILE,
)
from apps.poker_engine.hand_eval import estimate_equity_monte_carlo
from apps.poker_engine.replay import (
    AUTOMATIONS, CHIPS_PER_BB, _bb, _board_strs, _card_str, _snapshot,
    _street_name,
)

# Heads-up seat labels in PokerKit index order (verified in replay.py and by
# probe: index 0 = BB, index 1 = SB/Button). The hero is the Button.
SEATS = ['BB', 'SB']
HERO = 'SB'
BOT = 'BB'
_HERO_INDEX = SEATS.index(HERO)
_BOT_INDEX = SEATS.index(BOT)

_RANKS = '23456789TJQKA'
_SUITS = 'shdc'
_FULL_DECK = [r + s for r in _RANKS for s in _SUITS]

# Rollouts for equity used in bot decisions and hero grading. Low enough to keep
# a live request snappy, high enough that the continue/fold calls are stable.
_BOT_EQUITY_SIMS = 250
_GRADE_EQUITY_SIMS = 500


class HeadsUpHand:
    """A single heads-up hand vs the bot, reconstructable from its serial form."""

    def __init__(self, seed, profile=DEFAULT_PROFILE, small_blind=0.5,
                 big_blind=1.0, stack=100.0, bot_params=None, grading='gto'):
        """A heads-up hand vs the rule-based bot.

        ``bot_params`` (Exploit Lab, Module 5) is a jittered ``BotProfile`` as a
        kwargs dict; when present it overrides ``profile`` and gives this hand a
        match-specific opponent. ``grading`` selects how a hero decision is
        scored:

          * ``'gto'`` (default, unchanged): grade against the static charts /
            pot-odds EV and emit a BKT observation — the Arena behaviour.
          * ``'exploit'``: emit **no** observation (exploitative play is a
            deliberate deviation from GTO; grading it would punish the exact
            adjustments the mode teaches) and instead attach a cheap
            ``decision_context`` for post-hoc frequency scoring.
        """
        self.seed = seed
        self.profile = profile
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.stack = stack
        self.bot_params = bot_params
        self.grading = grading
        self.actions = []            # persisted betting log (hero + bot)
        self._bot = RuleBasedBot(BotProfile(**bot_params) if bot_params else profile)
        self._build_state()

    # ------------------------------------------------------------------ #
    # construction / reconstruction
    # ------------------------------------------------------------------ #
    def _build_state(self):
        """Deal the deterministic deck and post blinds; leave holes dealt."""
        rng = random.Random(self.seed)
        self._stream = iter(rng.sample(_FULL_DECK, len(_FULL_DECK)))

        blinds = (int(self.small_blind * CHIPS_PER_BB), int(self.big_blind * CHIPS_PER_BB))
        stack_chips = int(self.stack * CHIPS_PER_BB)
        self._state = NoLimitTexasHoldem.create_state(
            AUTOMATIONS, True, 0, blinds, blinds[1],
            (stack_chips, stack_chips), len(SEATS),
        )
        while self._state.can_deal_hole():
            self._state.deal_hole(next(self._stream))
        # Capture both hands at deal time: PokerKit's HAND_KILLING automation
        # clears the losing hand's cards at showdown, so we can't read them off
        # the final state.
        self._hero_hole = [_card_str(c) for c in self._state.hole_cards[_HERO_INDEX]]
        self._villain_hole = [_card_str(c) for c in self._state.hole_cards[_BOT_INDEX]]
        # Largest pot seen during the hand (chips are pushed to 0 at showdown,
        # so we can't read the contested pot off the final state).
        self._peak_pot = self._state.total_pot_amount

    @classmethod
    def new(cls, seed, profile=DEFAULT_PROFILE, **kwargs):
        """Start a fresh hand and advance to the first hero decision."""
        hand = cls(seed, profile, **kwargs)
        hand._advance()
        return hand

    def serialize(self) -> dict:
        """Everything needed to rebuild this hand on the next request."""
        return {
            'seed': self.seed,
            'profile': self.profile,
            'small_blind': self.small_blind,
            'big_blind': self.big_blind,
            'stack': self.stack,
            'bot_params': self.bot_params,
            'grading': self.grading,
            'actions': list(self.actions),
        }

    @classmethod
    def restore(cls, data: dict) -> 'HeadsUpHand':
        """Rebuild a hand from ``serialize()`` output by replaying its log.

        ``bot_params``/``grading`` default to ``None``/``'gto'`` so LiveHand rows
        persisted before Exploit Lab existed restore exactly as before.
        """
        hand = cls(
            data['seed'], data.get('profile', DEFAULT_PROFILE),
            small_blind=data.get('small_blind', 0.5),
            big_blind=data.get('big_blind', 1.0),
            stack=data.get('stack', 100.0),
            bot_params=data.get('bot_params'),
            grading=data.get('grading', 'gto'),
        )
        for action in data.get('actions', []):
            hand._deal_pending_board()
            hand._apply(action['op'], action.get('amount'))
        hand._advance()
        return hand

    # ------------------------------------------------------------------ #
    # state queries
    # ------------------------------------------------------------------ #
    @property
    def is_complete(self) -> bool:
        return not self._state.status

    @property
    def hero_to_act(self) -> bool:
        idx = self._state.actor_index
        return idx is not None and SEATS[idx] == HERO

    def legal_actions(self) -> list[dict]:
        """Legal actions for whoever is currently to act, in BB units."""
        s = self._state
        legal = []
        if s.actor_index is None:
            return legal
        if s.can_fold():
            legal.append({'type': 'fold'})
        if s.can_check_or_call():
            amount = s.checking_or_calling_amount
            if amount:
                legal.append({'type': 'call', 'amount_bb': _bb(amount)})
            else:
                legal.append({'type': 'check'})
        if s.can_complete_bet_or_raise_to():
            legal.append({
                'type': 'raise_to',
                'min_bb': _bb(s.min_completion_betting_or_raising_to_amount),
                'max_bb': _bb(s.max_completion_betting_or_raising_to_amount),
            })
        return legal

    def current_frame(self) -> dict:
        """Snapshot for the frontend, matching replay.py's frame contract.

        At a hero decision the frame carries ``legal_actions``; at completion it
        carries the showdown (both hole cards + outcome).
        """
        s = self._state
        seat_actions = self._seat_actions()
        if self.is_complete:
            frame = _snapshot(s, SEATS, _HERO_INDEX, 'showdown',
                              'Hand complete.', seat_actions=seat_actions)
            # Restore hero cards cleared by HAND_KILLING so the table still shows
            # them at showdown.
            frame['hero_cards'] = self._hero_hole
            frame['result'] = self.result()
            return frame
        kind = 'decision' if self.hero_to_act else 'action'
        narration = 'Your turn — what do you do?' if self.hero_to_act else 'Bot is acting...'
        frame = _snapshot(s, SEATS, _HERO_INDEX, kind, narration,
                          seat_actions=seat_actions)
        if self.hero_to_act:
            frame['legal_actions'] = self.legal_actions()
        return frame

    def _seat_actions(self):
        """Most-recent per-seat action badges for the current betting round.

        Each action carries the street it happened on, so when the log moves to
        a new street the previous round's non-fold badges (Bet/Raise/Call/Check)
        are cleared while folds persist for the whole hand — matching replay.py.
        """
        badges = {name: None for name in SEATS}
        current_street = None
        for a in self.actions:
            street = a.get('street')
            if street != current_street:
                current_street = street
                badges = {
                    name: ('Fold' if badge == 'Fold' else None)
                    for name, badge in badges.items()
                }
            actor = a['actor']
            if a['op'] == 'fold':
                badges[actor] = 'Fold'
            elif a['op'] == 'raise_to':
                badges[actor] = 'Raise' if a.get('opening') is False else 'Bet'
            else:
                badges[actor] = a.get('badge', 'Call')
        return badges

    def result(self) -> dict | None:
        """Outcome + showdown once the hand is over, else None."""
        if not self.is_complete:
            return None
        s = self._state
        stack_chips = int(self.stack * CHIPS_PER_BB)
        hero_net = _bb(s.stacks[_HERO_INDEX] - stack_chips)
        if hero_net > 0:
            outcome = 'win'
        elif hero_net < 0:
            outcome = 'loss'
        else:
            outcome = 'tie'
        return {
            'outcome': outcome,
            'hero_net_bb': round(hero_net, 2),
            'hero_cards': self._hero_hole,
            'villain_cards': self._villain_hole,
            'board': _board_strs(s),
            'pot_bb': round(_bb(self._peak_pot), 2),
        }

    # ------------------------------------------------------------------ #
    # driving the hand
    # ------------------------------------------------------------------ #
    def act_hero(self, action: dict) -> dict:
        """Apply the hero's action, score it, then run the bot to the next stop.

        Returns ``{'observation', 'decision_context', 'frame'}``:

          * ``'gto'`` grading: ``observation`` is the graded dict the view
            records as a ``source='hand'`` SkillObservation (or None when the
            decision has no closed-form benchmark); ``decision_context`` is None.
          * ``'exploit'`` grading: ``observation`` is always None (no BKT write);
            ``decision_context`` carries the facts Exploit Lab's frequency
            scorer needs, tagged with nothing else — the caller adds phase/hand.
        """
        if not self.hero_to_act:
            raise ValueError("It is not the hero's turn to act.")
        if self.grading == 'exploit':
            observation = None
            context = self._decision_context(action)
        else:
            observation = self._grade_hero_decision(action)
            context = None
        op, amount = self._decode_action(action)
        self._apply(op, amount)
        self._advance()
        return {
            'observation': observation,
            'decision_context': context,
            'frame': self.current_frame(),
        }

    def _advance(self):
        """Deal streets and run bot turns until the hero must act or hand ends."""
        while True:
            if self._state.actor_index is None:
                if self._state.can_deal_board():
                    self._deal_pending_board()
                    continue
                break  # hand complete
            if SEATS[self._state.actor_index] == HERO:
                break  # await hero input
            self._bot_act()

    def _deal_pending_board(self):
        if self._state.actor_index is not None or not self._state.can_deal_board():
            return
        count = 3 if not _board_strs(self._state) else 1
        for _ in range(count):
            self._state.deal_board(next(self._stream))

    def _bot_act(self):
        equity = self._equity(_BOT_INDEX, _BOT_EQUITY_SIMS, salt='bot')
        s = self._state
        to_call = _bb(s.checking_or_calling_amount) if s.can_check_or_call() else 0.0
        hand_state = {
            'legal_actions': self.legal_actions(),
            'equity': equity,
            'pot_bb': _bb(s.total_pot_amount),
            'to_call_bb': to_call,
            'rng': random.Random(f"{self.seed}:botrng:{len(self.actions)}"),
        }
        action = self._bot.get_action(hand_state)
        op, amount = self._decode_action(action)
        self._apply(op, amount)

    # ------------------------------------------------------------------ #
    # low-level apply
    # ------------------------------------------------------------------ #
    def _decode_action(self, action: dict):
        t = action['type']
        if t == 'fold':
            return 'fold', None
        if t in ('check', 'call'):
            return 'check_call', None
        if t == 'raise_to':
            return 'raise_to', action['amount_bb']
        raise ValueError(f"Unknown action type: {t}")

    def _apply(self, op: str, amount):
        """Apply one betting action to PokerKit and append it to the log."""
        s = self._state
        actor = SEATS[s.actor_index]
        # Record the street the action happened on so badge rendering can reset
        # per betting round and grading can group decisions by street.
        record = {'actor': actor, 'op': op, 'street': _street_name(s)}
        if op == 'fold':
            s.fold()
            record['badge'] = 'Fold'
        elif op == 'check_call':
            calling = s.checking_or_calling_amount
            s.check_or_call()
            record['badge'] = 'Call' if calling else 'Check'
        elif op == 'raise_to':
            record['opening'] = not any(s.bets)
            s.complete_bet_or_raise_to(int(round(amount * CHIPS_PER_BB)))
            record['amount'] = amount
            record['badge'] = 'Bet' if record['opening'] else 'Raise'
        else:
            raise ValueError(f"Unknown op: {op}")
        self.actions.append(record)
        self._peak_pot = max(self._peak_pot, s.total_pot_amount)

    # ------------------------------------------------------------------ #
    # equity + grading
    # ------------------------------------------------------------------ #
    def _equity(self, seat_index, sims, salt):
        s = self._state
        hole = [_card_str(c) for c in s.hole_cards[seat_index]]
        board = _board_strs(s)
        # Deterministic per decision point so reconstruction is reproducible
        # across processes. Built-in hash() is salted per process
        # (PYTHONHASHSEED), so a seeded RNG is used instead — the same approach
        # as the bot RNG above.
        eq_seed = random.Random(
            f"{self.seed}:{salt}:{len(self.actions)}"
        ).getrandbits(32)
        return estimate_equity_monte_carlo(
            hole, board, num_opponents=1, num_simulations=sims, seed=eq_seed,
        )

    def _decision_context(self, action: dict) -> dict:
        """Cheap, ungraded facts about the hero's pending decision (exploit mode).

        Mirrors the inputs ``_grade_hero_decision`` reads, but scores nothing —
        Exploit Lab classifies these into spot types (bluff / thin-value /
        bluff-catch) and measures the hero's action frequencies against the
        bot's known leak *after* the match. Equity uses the same seeded-salt
        scheme as grading so reconstruction stays deterministic across workers;
        cost equals the grading path this replaces (no added request latency).
        """
        s = self._state
        op, amount = self._decode_action(action)
        action_word = {'fold': 'fold', 'check_call': 'call', 'raise_to': 'raise'}[op]
        to_call = s.checking_or_calling_amount if s.can_check_or_call() else 0
        return {
            'street': _street_name(s),
            'equity': round(self._equity(_HERO_INDEX, _GRADE_EQUITY_SIMS, salt='exploit'), 4),
            'pot_bb': _bb(s.total_pot_amount),
            'to_call_bb': _bb(to_call),
            'facing_bet': bool(to_call) and s.can_fold(),
            'action': action_word,
            'amount_bb': amount,
        }

    def _grade_hero_decision(self, action: dict) -> dict | None:
        """Score the hero's pending decision into a BKT observation, or None.

        Preflop: graded against the heads-up Button open chart (preflop_range).
        Postflop facing a bet: graded by closed-form pot-odds EV (pot_odds).
        A postflop check / open (nothing to call) isn't graded — there is no
        single closed-form benchmark for it at this milestone.
        """
        s = self._state
        street = _street_name(s)
        op, amount = self._decode_action(action)
        action_word = {'fold': 'fold', 'check_call': 'call', 'raise_to': 'raise'}[op]

        # The hero's *first* action of the hand is the Button open decision,
        # graded against the heads-up open chart. Any later preflop action faces
        # a 3-bet and is a defend/price decision, graded like a postflop bet.
        hero_has_acted = any(a['actor'] == HERO for a in self.actions)
        if street == 'preflop' and not hero_has_acted:
            hole = [_card_str(c) for c in s.hole_cards[_HERO_INDEX]]
            decision = {'skill': 'preflop_range', 'action': action_word}
            graded = ev_eval.evaluate_decision_ev(
                decision,
                {'hole_cards': hole, 'position': HERO, 'heads_up': True},
            )
            graded['street'] = street
            return graded

        to_call = s.checking_or_calling_amount if s.can_check_or_call() else 0
        if to_call and s.can_fold():   # facing a real bet
            equity = self._equity(_HERO_INDEX, _GRADE_EQUITY_SIMS, salt='grade')
            graded = ev_eval.evaluate_decision_ev(
                {'skill': 'pot_odds', 'action': action_word},
                {
                    'equity': equity,
                    # total_pot_amount already includes the villain's outstanding
                    # bet (the amount to call); ev_eval wants exactly that pot,
                    # matching the bot/replay convention. Do NOT subtract to_call.
                    'pot_before_call': _bb(s.total_pot_amount),
                    'bet_to_call': _bb(to_call),
                },
            )
            graded['street'] = street
            return graded
        return None
