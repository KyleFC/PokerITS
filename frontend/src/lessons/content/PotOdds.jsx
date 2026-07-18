import React from 'react';
import { Link } from 'react-router-dom';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import PotOddsCalculator from '../../components/learn/widgets/PotOddsCalculator';
import CallEVExplorer from '../../components/learn/widgets/CallEVExplorer';
import { requiredEquityFromPreBet, BET_SIZE_PRESETS, pct } from '../math';

// Lesson 5 — Pot odds & required equity. Formulas and the three "classic
// mistake" distractors are stated exactly as generate_pot_odds() explains and
// tests them; the size ladder is computed from the generator's _BET_SIZES.
const LADDER_ROWS = BET_SIZE_PRESETS.map(({ label, fraction }) => ({
  label,
  required: pct(requiredEquityFromPreBet(1, fraction), 1),
}));

const PotOdds = () => (
  <>
    <LessonSection id="the-price-of-a-call" title="The price of a call">
      <p>
        Every bet you face is an offer with a price tag. Villain bets 5 BB into a 10 BB pot: to
        continue, you pay 5 to win the 15 already out there. Whether that's a good deal depends on
        exactly one comparison — <strong className="text-white">how often your hand wins versus how
        often it needs to win at that price</strong>. The first number is your equity (last
        lesson); the second is what this lesson computes.
      </p>
      <p>
        In odds form, you're being laid 15 : 5 = 3 : 1. But the percentage form is what plugs
        straight into decisions, so that's the one to master.
      </p>
    </LessonSection>

    <LessonSection id="required-equity" title="Required equity">
      <p>
        The break-even point comes from asking: of the pot as it will stand <em>after</em> your
        call, what share did you contribute? With a pre-bet pot P and a bet B, the pot after your
        call is P + 2B (the pot, villain's bet, and your call), and you put in B of it:
      </p>
      <Formula note="Both forms are the same statement: your risk divided by everything that will be in the middle once you've matched the bet.">
        required equity = call / (pot after your call) = B / (P + 2B) = risk / (risk + reward)
      </Formula>
      <p>
        Win more often than that and calling makes money; less often, and every call leaks EV.
        Because the formula depends only on the <em>ratio</em> of bet to pot, the answer for each
        standard sizing is a constant worth memorizing:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-w-md">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-4 font-bold">Villain bets</th>
              <th className="py-2 font-bold">You need</th>
            </tr>
          </thead>
          <tbody>
            {LADDER_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-slate-800/60">
                <td className="py-2 pr-4 font-semibold text-slate-200">{row.label}</td>
                <td className="py-2 font-mono text-indigo-300">{row.required}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PotOddsCalculator initialPot={10} initialBet={5} />
    </LessonSection>

    <LessonSection id="common-mistakes" title="Common mistakes">
      <p>
        Three wrong formulas account for nearly every pot-odds error — the drills use them as
        answer options on purpose, so learn to recognize each one:
      </p>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="text-rose-400 font-mono shrink-0">B / (P + B)</span>
          <span>
            <strong className="text-white">Forgetting your own call.</strong> The pot you're
            measuring against must include the call you're about to make — it will be in the middle
            when the hand is decided.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-rose-400 font-mono shrink-0">B / P</span>
          <span>
            <strong className="text-white">Dividing by the pre-bet pot.</strong> That ratio is the
            bet <em>sizing</em> (alpha, a later lesson) — useful, but not a break-even equity.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-rose-400 font-mono shrink-0">P / (P + B)</span>
          <span>
            <strong className="text-white">Computing MDF instead.</strong> That's the mirror
            concept: how much of your <em>range</em> must defend, not what <em>this hand</em> needs
            to call. The two add context to each other but answer different questions — the MDF
            lesson draws the full contrast.
          </span>
        </li>
      </ul>
    </LessonSection>

    <LessonSection id="putting-it-together" title="Putting it together">
      <WorkedExample title="Worked example: flush draw offered a half-pot price">
        <Step n={1}>
          River-less spot: you hold a flush draw on the turn, pot 10 BB, villain bets 5 BB. Price:
          5 / (10 + 5 + 5) = <strong className="text-white">25%</strong> required equity.
        </Step>
        <Step n={2}>
          Your equity, one card to come: 9 outs ≈ <strong className="text-white">19%</strong>.
        </Step>
        <Step n={3}>
          19% &lt; 25%: <strong className="text-rose-400">fold, at this price</strong>. The call
          would lose about a fifth of a big blind on average — small, but paid every time.
        </Step>
        <Step n={4}>
          Change the price and the answer flips: at a quarter-pot bet (2.5 into 10) you'd need only
          ~17%, and the same 19% draw calls profitably. The hand didn't change — the price did.
        </Step>
      </WorkedExample>
      <Callout tone="key" title="Pot odds are a fold-or-continue floor, not the whole story">
        <p>
          Direct pot odds assume the betting ends here. When more chips can go in on later streets,
          a hand can profitably call <em>worse</em> than its direct price — that's implied odds,
          the next lesson. And this lesson's EV framing is the same one from Lesson 1; revisit it
          with the price in mind:
        </p>
      </Callout>
      <CallEVExplorer initialPot={10} initialBet={5} initialEquity={19} />
      <p className="text-sm text-slate-400">
        Prefer drilling to reading?{' '}
        <Link to="/practice?skill=pot_odds" className="text-indigo-400 hover:text-indigo-300 font-semibold">
          Jump straight into pot-odds questions
        </Link>{' '}
        — the generator deals the exact sizes from the ladder above.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Required equity = call / (pot after your call) = B / (P + 2B) = risk / (risk + reward).',
        'It depends only on the bet-to-pot ratio: half pot → 25%, pot → 33.3%, 2x pot → 40%.',
        'The three classic errors: dropping your own call, dividing by the pre-bet pot, and quoting MDF.',
        'Compare price to equity from the same timeframe — one-street equity against a one-street price.',
        'Direct pot odds assume no future betting; implied odds (next lesson) relax that.',
      ]}
    />
  </>
);

export default PotOdds;
