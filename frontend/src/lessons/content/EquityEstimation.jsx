import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import EquityRuleExplorer from '../../components/learn/widgets/EquityRuleExplorer';
import { exactTurnEquity, exactRiverEquity, ruleOf2, ruleOf4 } from '../math';

// Lesson 4 — Equity & the rule of 2 and 4. All numbers computed through
// lessons/math.js, which mirrors generate_equity_estimation() exactly.
const ACCURACY_ROWS = [
  { outs: 4, draw: 'Gutshot' },
  { outs: 8, draw: 'Open-ender' },
  { outs: 9, draw: 'Flush draw' },
  { outs: 15, draw: 'Combo draw' },
].map(({ outs, draw }) => ({
  outs,
  draw,
  exactTurn: (exactTurnEquity(outs) * 100).toFixed(1),
  rule2: ruleOf2(outs),
  exactRiver: (exactRiverEquity(outs) * 100).toFixed(1),
  rule4: ruleOf4(outs),
}));

const EquityEstimation = () => (
  <>
    <LessonSection id="what-is-equity" title="What is equity?">
      <p>
        Your <strong className="text-white">equity</strong> is the probability your hand wins the
        pot — equivalently, the share of the pot that is "yours" on average right now. A flush draw
        against a made pair isn't losing; it owns roughly a third of the pot, paid out in the long
        run. Every EV calculation in this curriculum consumes an equity number, and for drawing
        hands that number comes straight from your out count.
      </p>
      <p>
        This lesson turns the counts from the previous lesson into percentages you can produce at
        the table in two seconds, without arithmetic heroics.
      </p>
    </LessonSection>

    <LessonSection id="one-street" title="One card to come">
      <p>
        On the flop, 47 cards are unseen and each is equally likely to arrive on the turn. The
        probability the next card is one of your outs is simply:
      </p>
      <Formula note={`Example: a flush draw has 9 outs, so P = 9/47 ≈ ${(exactTurnEquity(9) * 100).toFixed(1)}%.`}>
        P(hit the next card) = outs / 47
      </Formula>
      <p>
        The table shortcut is the <strong className="text-white">rule of 2</strong>: multiply your
        outs by 2 to get a percentage. Nine outs ≈ 18%. It slightly undershoots the true value —
        close enough for any real decision.
      </p>
      <Callout tone="warn" title="Use the one-street number for one-street decisions">
        <p>
          Facing a bet on the turn, or a flop bet you expect to face again on the turn? The relevant
          probability is the <em>next card only</em>. Quoting your by-the-river number in a
          one-street spot is the classic way to talk yourself into a bad call — and the drills
          offer exactly that trap as a wrong answer.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="two-streets" title="Two cards to come">
      <p>
        Seeing both the turn <em>and</em> the river (say, facing an all-in on the flop), you have
        two chances to hit. The clean way to compute it is through the miss probability:
      </p>
      <Formula note={`Example, 9 outs: 1 − (38/47 × 37/46) ≈ ${(exactRiverEquity(9) * 100).toFixed(1)}%.`}>
        P(hit by the river) = 1 − (47 − outs)/47 × (46 − outs)/46
      </Formula>
      <p>
        The shortcut is the <strong className="text-white">rule of 4</strong>: outs × 4. Nine outs
        ≈ 36%. Again a touch generous, but in the right neighborhood instantly.
      </p>
    </LessonSection>

    <LessonSection id="rule-accuracy" title="How accurate is the rule?">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-4 font-bold">Draw</th>
              <th className="py-2 pr-4 font-bold">Outs</th>
              <th className="py-2 pr-4 font-bold">Exact, next card</th>
              <th className="py-2 pr-4 font-bold">Rule of 2</th>
              <th className="py-2 pr-4 font-bold">Exact, by river</th>
              <th className="py-2 font-bold">Rule of 4</th>
            </tr>
          </thead>
          <tbody>
            {ACCURACY_ROWS.map((row) => (
              <tr key={row.outs} className="border-b border-slate-800/60">
                <td className="py-2.5 pr-4 font-semibold text-slate-200 whitespace-nowrap">{row.draw}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-300">{row.outs}</td>
                <td className="py-2.5 pr-4 font-mono text-indigo-300">{row.exactTurn}%</td>
                <td className="py-2.5 pr-4 font-mono text-slate-400">{row.rule2}%</td>
                <td className="py-2.5 pr-4 font-mono text-indigo-300">{row.exactRiver}%</td>
                <td className="py-2.5 font-mono text-slate-400">{row.rule4}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The pattern: the rule of 2 tracks the exact number closely everywhere, and the rule of 4 is
        honest for normal draws but <strong className="text-white">overshoots big draws</strong> —
        a 15-out combo draw is really {(exactRiverEquity(15) * 100).toFixed(1)}%, not 60%. Exact
        values run slightly under the rule of 4 for big draws; shave a few points off once you're
        past 12 outs.
      </p>
      <EquityRuleExplorer />
    </LessonSection>

    <LessonSection id="from-outs-to-decisions" title="From outs to decisions">
      <WorkedExample title="Worked example: flush draw facing a turn bet">
        <Step n={1}>
          You hold a flush draw on the turn and face a bet. One card is coming, so the number that
          matters is the one-street figure: 9 outs ≈ <strong className="text-white">19%</strong>
          {' '}(9/46 with the turn already out — the rule of 2's 18% is close enough).
        </Step>
        <Step n={2}>
          Not 36%. The rule-of-4 number assumed you'd see <em>two</em> cards; the bet in front of
          you is charging for one.
        </Step>
        <Step n={3}>
          Whether ~19% is enough depends entirely on the price — which is precisely the next
          lesson. Equity is half of every calling decision; pot odds are the other half.
        </Step>
      </WorkedExample>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Equity is your win probability — your average share of the pot right now.',
        'One card to come: outs / 47 exactly; outs × 2 as the table shortcut.',
        'Two cards to come: 1 − (47−outs)/47 × (46−outs)/46; outs × 4 as the shortcut.',
        'The rule of 4 overshoots big draws — a 15-out monster is ~54%, not 60%.',
        'Match the timeframe to the decision: one-street numbers for one-street prices.',
      ]}
    />
  </>
);

export default EquityEstimation;
