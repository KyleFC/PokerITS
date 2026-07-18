import functools
import secrets

from django.db import transaction
from rest_framework import views, status, permissions, generics
from rest_framework.response import Response
from apps.poker_engine.serializers import PublicScenarioSerializer, HandHistorySerializer
from apps.poker_engine.scenario_bank import load_scenarios, get_scenario_by_id
from apps.poker_engine.replay import build_replay, ReplayError
from apps.poker_engine import generators
from apps.poker_engine.models import LiveHand, HandHistory
from apps.poker_engine.game_loop import HeadsUpHand
from apps.poker_engine.bot_strategy import BOT_PROFILES, DEFAULT_PROFILE
from apps.poker_engine import preflop_charts, preflop_mixed_charts

# Seeds are drawn from this range and embedded in the scenario id. 2**31 keeps
# the id short (well under SkillObservation.reference_id's 50-char limit) while
# giving a practically unbounded stream of distinct questions per skill.
_SEED_SPACE = 2 ** 31

class ScenarioListView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        scenarios = load_scenarios()
        skill = request.query_params.get('skill')
        if skill:
            scenarios = [s for s in scenarios if s.get('skill') == skill]

        serializer = PublicScenarioSerializer(scenarios, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class GenerateScenarioView(views.APIView):
    """Serve one freshly generated scenario for infinite practice mode.

    ``GET /poker/scenarios/generate/?skill=<skill>`` returns a public
    (answer-key-stripped) scenario whose id encodes the seed that produced it,
    so the same server-side grader (which regenerates from that id) can score
    the eventual answer. Nothing is persisted.

    With no ``skill`` param the endpoint targets practice where it helps most:
    for an authenticated student it samples a skill weighted toward the ones
    with the lowest BKT mastery; otherwise it picks uniformly at random. Only
    skills that actually have a generator are ever chosen.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        skill = request.query_params.get('skill')
        if skill and skill not in generators.GENERATORS:
            return Response(
                {
                    "detail": f"No generator for skill: {skill}",
                    "available_skills": sorted(generators.GENERATORS),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not skill:
            skill = self._pick_skill(request)

        scenario = generators.generate(skill, secrets.randbelow(_SEED_SPACE))
        return Response(PublicScenarioSerializer(scenario).data, status=status.HTTP_200_OK)

    def _pick_skill(self, request):
        """Choose which skill to drill, biased toward the student's weak spots.

        Imported lazily so poker_engine has no import-time dependency on
        student_model (which already imports poker_engine's scenario bank —
        keeping the reverse dependency lazy avoids a circular import).
        """
        import random

        available = sorted(generators.GENERATORS)
        user = request.user
        if user and user.is_authenticated:
            from apps.student_model.models import StudentProfile

            profile = StudentProfile.objects.filter(user=user).first()
            skills = profile.skills if profile else {}
            # Weight each generatable skill by how far it is from mastery, with a
            # small floor so mastered skills still resurface occasionally.
            weights = [max(0.05, 1.0 - skills.get(s, 0.0)) for s in available]
            if any(w > 0 for w in weights):
                return random.choices(available, weights=weights, k=1)[0]
        return random.choice(available)


class ScenarioDetailView(views.APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PublicScenarioSerializer(scenario)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ScenarioReplayView(views.APIView):
    """Return the scripted hand replay (display frames) for a scenario.

    Runs the scenario's ``gameplay`` script through the poker engine server-side
    and returns the resulting frames plus the public (answer-key-stripped)
    scenario. The ``gameplay`` block itself — villain scripting and any exact
    villain cards — is never serialized to the client; only the frame snapshots
    (which reveal only the hero's cards) are sent. Same permissive access policy
    as the scenario list, since nothing here leaks the answer.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, scenario_id, *args, **kwargs):
        scenario = get_scenario_by_id(scenario_id)
        if not scenario:
            return Response({"detail": "Scenario not found."}, status=status.HTTP_404_NOT_FOUND)
        if not scenario.get('gameplay'):
            return Response(
                {"detail": "Scenario has no gameplay script."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            replay = build_replay(scenario)
        except ReplayError as exc:
            # A malformed script is a scenario-authoring bug, not a client error.
            return Response(
                {"detail": f"Scenario replay could not be built: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        replay['scenario'] = PublicScenarioSerializer(scenario).data
        return Response(replay, status=status.HTTP_200_OK)


def _sparse_mix(position, klass):
    mix = preflop_mixed_charts.mixed_strategy(position, klass)
    return {a: f for a, f in mix.items() if a != 'fold' and f > 0}


@functools.lru_cache(maxsize=1)
def _preflop_ranges_payload():
    """Build the preflop-ranges response once and cache it.

    Every field derives from import-time chart constants, so the payload is
    identical on every request; building it per request re-sorted every chart
    and rebuilt every sparse-mix dict for a byte-identical result.
    """
    rfi_positions = [
        {
            'code': pos,
            'name': preflop_charts.POSITION_NAMES[pos],
            'actions': ['raise'],
            'simple': {'raise': sorted(preflop_charts.RFI_RANGES[pos])},
            'mixed': {
                k: _sparse_mix(pos, k)
                for k in preflop_mixed_charts.RFI_MIXED[pos]
            },
            'fraction': round(preflop_charts.range_fraction(pos), 4),
            'open_raise_size_bb': preflop_charts.OPEN_RAISE_SIZE_BB,
        }
        for pos in ('UTG', 'HJ', 'CO', 'BTN')
    ]
    sb_position = {
        'code': 'SB',
        'name': preflop_charts.POSITION_NAMES['SB'],
        'actions': ['raise', 'call'],
        'simple': {
            'raise': sorted(preflop_charts.SB_SIMPLE['raise']),
            'call': sorted(preflop_charts.SB_SIMPLE['call']),
        },
        'mixed': {
            k: _sparse_mix('SB', k)
            for k in preflop_mixed_charts.SB_MIXED
        },
        'fraction': round(preflop_charts.sb_vpip_fraction(), 4),
        'open_raise_size_bb': preflop_mixed_charts.SB_OPEN_RAISE_SIZE_BB,
    }
    six_max = {
        'open_raise_size_bb': preflop_charts.OPEN_RAISE_SIZE_BB,
        'positions': rfi_positions + [sb_position],
    }
    heads_up = {
        'open_raise_size_bb': preflop_charts.HU_OPEN_RAISE_SIZE_BB,
        'positions': [
            {
                'code': role,
                'name': preflop_charts.HU_POSITION_NAMES[role],
                'actions': ['raise' if role == 'SB' else 'defend'],
                'simple': {
                    ('raise' if role == 'SB' else 'defend'):
                        sorted(preflop_charts.HU_RANGES[role]),
                },
                'fraction': round(preflop_charts.hu_range_fraction(role), 4),
                'open_raise_size_bb': preflop_charts.HU_OPEN_RAISE_SIZE_BB,
            }
            for role in ('SB', 'BB')
        ],
    }
    return {'six_max': six_max, 'heads_up': heads_up}


class PreflopRangesView(views.APIView):
    """Serve the preflop charts the tutor grades against, for display.

    ``GET /poker/ranges/`` returns both difficulty tiers for every position:
    ``simple`` — the binary/rounded charts as hand lists per action — and
    ``mixed`` — the solver-estimated action frequencies per hand (sparse:
    hands that always fold are omitted; zero-frequency actions are omitted).
    Same source of truth the quiz generator and EV grader use. Read-only
    static data — no auth required.
    """
    permission_classes = (permissions.AllowAny,)

    def get(self, request, *args, **kwargs):
        return Response(_preflop_ranges_payload(), status=status.HTTP_200_OK)


# Seed space for live hands: large enough to make repeats vanishingly unlikely,
# small enough to store compactly. The seed makes each hand reproducible for
# tests and debugging.
_HAND_SEED_SPACE = 2 ** 31


class LiveHandStartView(views.APIView):
    """Deal a new heads-up hand vs the bot and return the first frame.

    ``POST /poker/hands/`` with optional ``{'profile': 'nit'|'station'|...,
    'stack': 100}``. Persists the in-progress hand as a LiveHand row so the
    next action can rebuild it from the DB (project.md §2), and returns
    ``{'hand_id', 'frame'}``.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        profile = request.data.get('profile', DEFAULT_PROFILE)
        if profile not in BOT_PROFILES:
            return Response(
                {"detail": f"Unknown bot profile: {profile}",
                 "available_profiles": sorted(BOT_PROFILES)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stack = float(request.data.get('stack', 100))
        except (TypeError, ValueError):
            return Response({"detail": "stack must be a number."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (10 <= stack <= 1000):
            return Response({"detail": "stack must be between 10 and 1000 BB."},
                            status=status.HTTP_400_BAD_REQUEST)

        seed = secrets.randbelow(_HAND_SEED_SPACE)
        hand = HeadsUpHand.new(seed, profile=profile, stack=stack)

        state = hand.serialize()
        state['graded'] = []
        row = LiveHand.objects.create(
            user=request.user, state=state, complete=hand.is_complete,
        )
        return Response(
            {'hand_id': str(row.id), 'profile': profile, 'frame': hand.current_frame()},
            status=status.HTTP_201_CREATED,
        )


class LiveHandActionView(views.APIView):
    """Apply the hero's action to an in-progress hand and advance the bot.

    ``POST /poker/hands/<hand_id>/action/`` with
    ``{'type': 'fold'|'check'|'call'|'raise_to', 'amount_bb': <n for raise>}``.

    Rebuilds the hand from its persisted state, applies the action, runs the bot
    to the next hero decision (or showdown), grades the hero's decision through
    the EV-loss policy into a BKT observation, and persists everything. Returns
    ``{'frame', 'observation', 'complete', 'profile'}``.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, hand_id, *args, **kwargs):
        from apps.student_model.services import record_skill_observation
        from apps.student_model.serializers import StudentProfileSerializer

        # The whole read-modify-write runs under a row lock so two concurrent
        # posts for the same hand can't both apply an action (double-counting
        # the BKT observation) or both race to create the terminal HandHistory
        # (a duplicate-PK 500). On the production DB (Postgres) select_for_update
        # serializes them; the second waits, then re-reads the updated/complete
        # state and is rejected or graded against the genuinely new decision.
        with transaction.atomic():
            row = (
                LiveHand.objects.select_for_update()
                .filter(id=hand_id, user=request.user)
                .first()
            )
            if row is None:
                return Response({"detail": "Hand not found."}, status=status.HTTP_404_NOT_FOUND)
            if row.complete:
                return Response({"detail": "Hand is already complete."},
                                status=status.HTTP_409_CONFLICT)

            hand = HeadsUpHand.restore(row.state)
            if not hand.hero_to_act:
                return Response({"detail": "It is not your turn to act."},
                                status=status.HTTP_409_CONFLICT)

            action = self._validate_action(request.data, hand.legal_actions())
            if isinstance(action, Response):
                return action

            result = hand.act_hero(action)
            observation = result['observation']

            new_state = hand.serialize()
            graded = list(row.state.get('graded', []))
            if observation:
                graded.append(observation)
            new_state['graded'] = graded

            profile_data = None
            # An exploit-mode hand yields no GTO observation (observation is
            # None); its BKT signal comes from the match's diagnosis + execution
            # score instead. Only the Arena (gto) path records a 'hand'
            # observation here.
            if observation:
                obs = record_skill_observation(
                    user=request.user,
                    skill=observation['skill'],
                    correct=observation['correct'],
                    source='hand',
                    reference_id=str(row.id),
                )
                profile_data = StudentProfileSerializer(obs['profile']).data

            row.state = new_state
            if hand.is_complete:
                row.complete = True
                # Exploit Lab hands are copied into HandHistory too (with the
                # match FK) so the reveal and future review can read them, but
                # they carry no GTO grade — pass the (empty) graded list.
                self._persist_hand_history(request.user, row.id, hand, graded,
                                           match=row.match)
            row.save()

            # Match hook: record the hero's decision context and, on completion,
            # advance the phase (and record the opponent_reading observation).
            # Lock order is always LiveHand (held above) -> ExploitMatch.
            if row.match_id:
                from apps.poker_engine.exploit_views import on_match_hand_action
                match_obs = on_match_hand_action(
                    row.match, row, hand, result['decision_context'],
                )
                if match_obs:
                    obs = record_skill_observation(
                        user=request.user,
                        skill=match_obs['skill'],
                        correct=match_obs['correct'],
                        source='exploit',
                        reference_id=str(row.match_id),
                    )
                    profile_data = StudentProfileSerializer(obs['profile']).data

        return Response(
            {
                'frame': result['frame'],
                'observation': observation,
                'complete': hand.is_complete,
                'profile': profile_data,
            },
            status=status.HTTP_200_OK,
        )

    def _validate_action(self, data, legal_actions):
        """Return a normalised action dict, or a 400 Response if illegal."""
        action_type = data.get('type')
        legal_types = {a['type'] for a in legal_actions}
        if action_type not in legal_types:
            return Response(
                {"detail": f"Illegal action '{action_type}'.",
                 "legal_actions": legal_actions},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action_type == 'raise_to':
            spec = next(a for a in legal_actions if a['type'] == 'raise_to')
            try:
                amount = float(data.get('amount_bb'))
            except (TypeError, ValueError):
                return Response({"detail": "raise_to requires a numeric amount_bb."},
                                status=status.HTTP_400_BAD_REQUEST)
            if not (spec['min_bb'] <= amount <= spec['max_bb']):
                return Response(
                    {"detail": f"raise_to amount {amount} outside "
                               f"[{spec['min_bb']}, {spec['max_bb']}] BB.",
                     "legal_actions": legal_actions},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return {'type': 'raise_to', 'amount_bb': amount}
        return {'type': action_type}

    def _persist_hand_history(self, user, hand_id, hand, graded, match=None):
        """Copy a finished hand into the append-only HandHistory log.

        ``match`` links Exploit Lab hands to their match (and keeps them out of
        Arena aggregates, which filter ``match__isnull=True``). For match hands
        ``graded`` is empty, so the EV fields below are simply null/absent.
        """
        res = hand.result()
        preflop_dev = next(
            (g['ev_loss_bb'] for g in graded if g['skill'] == 'preflop_range'), None
        )
        # Sum EV loss per street: a hero can make more than one graded facing-a-
        # bet decision on the same street (e.g. a raise, then a call after the
        # bot re-raises), and each is a real leak. Keying a plain dict by street
        # would drop all but the last, undercounting the hand.
        postflop_by_street = {}
        for g in graded:
            if g['skill'] == 'preflop_range':
                continue
            postflop_by_street[g['street']] = (
                postflop_by_street.get(g['street'], 0.0) + g['ev_loss_bb']
            )
        HandHistory.objects.create(
            id=hand_id,               # reuse the LiveHand id so they line up
            user=user,
            hole_cards=res['hero_cards'],
            board=res['board'],
            actions=hand.actions,
            pot_size=res['pot_bb'],
            net_bb=res['hero_net_bb'],
            # For a match hand the live opponent is a jittered mystery profile;
            # record its base archetype (the match owns the real params) rather
            # than the placeholder 'balanced' the exploit hand carries.
            bot_profile=match.base_profile if match else hand.profile,
            preflop_chart_deviation=preflop_dev,
            postflop_ev_loss_by_street=postflop_by_street,
            outcome=res['outcome'],
            match=match,
        )


class HandHistoryListView(generics.ListAPIView):
    """Paginated list of the user's completed hands, newest first.

    ``GET /poker/hands/history/`` — backs the Module 4 hand-review list. Each
    row carries the EV ground truth captured at play time (preflop chart
    deviation, per-street EV loss) alongside the variance-laden result, so the
    review UI can keep the decision/outcome separation front and centre.
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = HandHistorySerializer

    def get_queryset(self):
        # Exclude Exploit Lab hands: their opponent is a hidden jittered profile,
        # so listing them here would both leak the archetype mid-match and mix a
        # non-Arena game mode into the Arena history.
        return HandHistory.objects.filter(
            user=self.request.user, match__isnull=True,
        )


def _hand_ev_loss(hand) -> float:
    """Total graded EV loss for one completed hand, in BB."""
    total = hand.preflop_chart_deviation or 0.0
    total += sum((hand.postflop_ev_loss_by_street or {}).values())
    return total


def _went_to_showdown(hand) -> bool:
    """A heads-up hand reaches showdown exactly when nobody folded."""
    return not any(a.get('op') == 'fold' for a in (hand.actions or []))


class HandStatsView(views.APIView):
    """Aggregate the user's HandHistory for the Arena stats page.

    ``GET /poker/hands/stats/`` returns decision-quality metrics (EV loss —
    the numbers the ITS actually teaches to) alongside results metrics
    (BB won/lost — variance-laden, and framed that way by the frontend per
    project.md §1). Aggregation is done in Python: the EV fields live in JSON
    columns the ORM can't sum, and a user's hand count stays comfortably
    request-sized at this milestone.

    Hands recorded before ``net_bb`` existed have ``net_bb=None``; they count
    toward decision-quality metrics but contribute 0 to BB totals (the
    timeline marks them ``net_bb: null``) rather than being silently dropped.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        # Arena stats exclude Exploit Lab hands (match__isnull) — their jittered
        # mystery opponents would corrupt bb/100 and the by_profile breakdown.
        hands = list(
            HandHistory.objects.filter(user=request.user, match__isnull=True)
            .order_by('timestamp')
        )

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
            ev_loss = _hand_ev_loss(hand)
            cumulative_bb += net or 0.0
            cumulative_ev_loss += ev_loss

            record[hand.outcome] = record.get(hand.outcome, 0) + 1
            bucket = showdown if _went_to_showdown(hand) else non_showdown
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

        return Response({
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
        }, status=status.HTTP_200_OK)
