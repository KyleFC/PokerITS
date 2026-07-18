import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import SetMineJudge from '../../components/learn/widgets/SetMineJudge';

// Lesson 6 — Implied odds & set mining. Numbers verbatim from
// generate_implied_odds(): ~12% to flop a set (~7.5:1), 15-20x rule,
// clearly-deep >= ~20x / clearly-shallow <= ~8x zones.
const ImpliedOdds = () => (
  <>
    <LessonSection id="beyond-direct-odds" title="Beyond direct odds">
      <p>
        Pot odds price a call as if the betting ends the moment you match it. But when there are
        cards to come and chips behind, hitting your hand usually <em>wins more than the current
        pot</em> — the future bets you'll collect are part of the reward too.{' '}
        <strong className="text-white">Implied odds</strong> are pot odds with those future winnings
        added in:
      </p>
      <Formula note="The catch: 'expected future winnings' is an estimate, not a number on the table. Implied odds justify calls — they also justify wishful thinking. The disguised-hand test below keeps you honest.">
        effective price = call / (current pot + expected future winnings + call)
      </Formula>
      <p>
        Implied odds are largest when three things line up: the stacks are{' '}
        <strong className="text-white">deep</strong> (there's money left to win), your hand is{' '}
        <strong className="text-white">disguised</strong> (they can't see it coming and will pay
        off), and it's <strong className="text-white">strong when it hits</strong> (you won't be
        second-best). Small pocket pairs hunting sets are the textbook case — nothing on the board
        announces that 44 just became three of a kind.
      </p>
    </LessonSection>

    <LessonSection id="set-mining-math" title="Set-mining math">
      <p>
        You hold a small pair, someone raises, and you're deciding whether to call purely to flop a
        set. The direct math is brutal: you flop a set about{' '}
        <strong className="text-white">12% of the time — roughly 7.5 : 1 against</strong> — while a
        typical single-raised pot offers nowhere near 7.5 : 1 on the call. Direct pot odds{' '}
        <em>never</em> justify set mining on their own.
      </p>
      <WorkedExample title="Worked example: 4♥4♦ in the big blind vs a cutoff open">
        <Step n={1}>
          CO raises to 3 BB; you're in the BB, so continuing costs 2 BB more into a 4.5 BB pot
          (their 3, the SB's 0.5, your posted 1). Direct price: 2 / (4.5 + 2) ≈ 31% — and flopping
          a set is 12%. Called on direct odds alone, this is a disaster.
        </Step>
        <Step n={2}>
          At <strong className="text-white">100 BB effective</strong>, the call is 2 BB against
          98 BB behind — a 50x stack-to-call ratio. The ~12% of flops where you make a set can win
          a stack from an overpair or top pair; those wins fund the ~88% of flops you check-fold.{' '}
          <strong className="text-emerald-400">Call.</strong>
        </Step>
        <Step n={3}>
          Same spot at <strong className="text-white">12 BB effective</strong>: the ratio is 6x.
          Even winning the entire stack every time you hit wouldn't cover the misses.{' '}
          <strong className="text-rose-400">Fold.</strong> Identical cards, identical raise — the
          stacks made both decisions.
        </Step>
      </WorkedExample>
    </LessonSection>

    <LessonSection id="the-15-20x-rule" title="The 15-20x rule">
      <p>
        The set-mining rule of thumb: call to set-mine when the effective stack is at least{' '}
        <strong className="text-white">15-20 times the price of the call</strong>. That multiple
        covers the 7.5 : 1 odds against hitting, discounted for the times you hit and win only a
        small pot, stack off second-best, or your opponent simply doesn't pay you.
      </p>
      <SetMineJudge />
      <Callout tone="info" title="Why the drills always have one right answer">
        <p>
          The implied-odds questions in Infinite Practice only deal clearly-deep (≥ ~20x) or
          clearly-shallow (≤ ~8x) stacks, so the rule always gives one defensible answer. The band
          in between is real-table judgment: position, opponent tendencies, and how "sticky" the
          raiser's range is all move the line.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="reverse-implied-odds" title="Reverse implied odds">
      <p>
        The same telescope, looked through backwards: some hands lose <em>extra</em> money when they
        "hit." Call with K♦9♦, flop a king, and you're now committed to paying off AK. Make the
        bottom end of a straight and lose to the top end; flop a small flush and run into a bigger
        one; set-over-set will occasionally take your whole stack and there is nothing to be done
        about it.
      </p>
      <p>
        Hands that make second-best hands carry{' '}
        <strong className="text-white">reverse implied odds</strong> — their future betting rounds
        cost money instead of earning it. That's the hidden reason dominated offsuit hands fall out
        of the preflop charts long before their raw equity says they must: the chart already knows
        what your top pair, weak kicker will cost you on the river.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Implied odds = pot odds plus expected future winnings — the reward extends past the current pot.',
        'They demand deep stacks, a disguised hand, and strength when you hit.',
        'Set mining: ~12% to flop a set (~7.5:1 against) — direct pot odds never justify it on their own.',
        'The 15-20x rule: call only when the effective stack is at least 15-20 times the call.',
        'Reverse implied odds: hands that make second-best hands lose extra when they hit — why dominated hands leave the charts early.',
      ]}
    />
  </>
);

export default ImpliedOdds;
