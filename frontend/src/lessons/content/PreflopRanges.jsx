import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import OpeningRangeLadder from '../../components/learn/widgets/OpeningRangeLadder';

// Lesson 2 — Preflop ranges. Content mirrors preflop_charts.py /
// generate_preflop_range(): raise-or-fold RFI discipline, 2.5 BB opens,
// boundary hands quoted verbatim from BOUNDARY_HANDS.
const PreflopRanges = () => (
  <>
    <LessonSection id="why-ranges" title="Why ranges?">
      <p>
        Preflop is the one street you play in every single hand, from the same handful of
        situations, thousands of times. That repetition is exactly what makes it solvable: instead
        of deciding hand by hand, strong players decide <em>once</em> which set of hands they play
        from each seat — a <strong className="text-white">range</strong> — and then simply execute.
      </p>
      <p>
        A memorized baseline range does two things for you. It saves your thinking for the streets
        that actually need it, and it makes you unexploitable in the most-repeated spot in the game.
        Every preflop drill in this tutor is graded against these exact charts, and any deviation is
        flagged — the tolerance is zero, because the chart is a lookup, not a judgment call.
      </p>
    </LessonSection>

    <LessonSection id="the-169-grid" title="The 169-hand grid">
      <p>
        Ignoring suits' identities, there are only 169 distinct starting hands: 13 pocket pairs,
        78 suited combinations and 78 offsuit combinations. The standard notation writes the high
        card first: <span className="font-mono text-indigo-300">AKs</span> (suited),{' '}
        <span className="font-mono text-indigo-300">KQo</span> (offsuit),{' '}
        <span className="font-mono text-indigo-300">77</span> (pair).
      </p>
      <p>These classes are not equally likely — count the actual card combinations:</p>
      <Formula note="1,326 total two-card combos. A range's width is measured in combos, not classes: 'the top 20% of hands' means 20% of 1,326.">
        pair = 6 combos · suited = 4 combos · offsuit = 12 combos
      </Formula>
      <p>
        This is why an offsuit hand is three times as common as its suited twin, and why folding a
        weak offsuit class prunes far more junk from your range than folding the suited version of
        the same ranks.
      </p>
    </LessonSection>

    <LessonSection id="position-and-width" title="Position sets your width">
      <p>
        How wide you can open is almost entirely a function of how many players are still left to
        act behind you. Under the Gun has five untouched opponents who may wake up with a monster;
        the Button has two. Fewer players behind means fewer chances someone has you dominated —
        and a better seat for every later street.
      </p>
      <OpeningRangeLadder />
      <Callout tone="info" title="The Small Blind is the odd one out">
        <p>
          Every position above plays pure raise-or-fold, but the SB's solver strategy genuinely
          mixes 3.5 BB opens with limps — it already has money in and closes the action against
          only the BB. Its chart on the Ranges page is therefore three-action:
          raise, limp, or fold.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="raise-or-fold" title="Raise or fold">
      <p>
        When the action folds to you, the baseline charts allow exactly two answers: open-raise to{' '}
        <strong className="text-white">2.5 BB</strong>, or fold. If the hand is in your position's
        range, raise it — attacking the blinds with a playable hand keeps the initiative and makes
        your range hard to play against. If it's below the range, fold it: playing below-range
        hands invites domination and tough postflop spots.
      </p>
      <p>
        Two tempting third options are deliberately absent. <strong className="text-white">Open-limping
        is never chart-correct</strong> — it wins nothing immediately, gives the blinds a free or
        cheap flop, and announces a capped range. And oversized opens burn money: a 10 BB raise
        risks far too much to win the 1.5 BB sitting in the blinds.
      </p>
    </LessonSection>

    <LessonSection id="boundary-hands" title="Boundary hands — where the learning lives">
      <p>
        Nobody needs a chart to open aces or fold 72o. The chart earns its keep at the edge — hands
        that are an open from one seat and a fold from the seat before it. The drills deliberately
        oversample these boundary hands, because that is where students actually leak.
      </p>
      <WorkedExample title="Worked example: the same hands, one seat apart">
        <Step n={1}>
          <span className="font-mono text-indigo-300">KJo</span> from UTG is an{' '}
          <strong className="text-emerald-400">open</strong> — it just clears the tightest range in
          the game. <span className="font-mono text-indigo-300">KTo</span> from the same seat is a{' '}
          <strong className="text-rose-400">fold</strong>: one pip of kicker is the whole
          difference at the boundary.
        </Step>
        <Step n={2}>
          <span className="font-mono text-indigo-300">QJo</span> is a fold under the gun but an
          open from the Hijack. Nothing about the hand changed — one opponent left the pool, so
          the range widened past it.
        </Step>
        <Step n={3}>
          By the Button the boundary has slid into hands like{' '}
          <span className="font-mono text-indigo-300">J4s</span> (open) versus{' '}
          <span className="font-mono text-indigo-300">J3s</span> (fold). Absurdly thin — and
          exactly why "is this hand good?" is the wrong question. The right question is always{' '}
          <em>"is it good from here?"</em>
        </Step>
      </WorkedExample>
      <Callout tone="warn" title="Don't memorize the middle, memorize the edge">
        <p>
          When you study the charts on the Ranges page, spend your time tracing each position's
          boundary line, not re-reading the premium region. The drills will test you there, and so
          will real opponents.
        </p>
      </Callout>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Decide your preflop game once, as a range per seat — then execute without re-deciding.',
        '169 hand classes; pairs are 6 combos, suited 4, offsuit 12, out of 1,326 total.',
        'Width follows position: more players behind you means a tighter range.',
        'Folded to you: open-raise 2.5 BB or fold. Open-limping is never chart-correct, and oversizing risks too much to win 1.5 BB.',
        'The learning lives at the chart boundary — drill the edge hands, not the obvious ones.',
      ]}
    />
  </>
);

export default PreflopRanges;
