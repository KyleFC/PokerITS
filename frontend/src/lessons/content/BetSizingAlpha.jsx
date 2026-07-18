import React from 'react';
import { Link } from 'react-router-dom';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import BluffBreakevenExplorer from '../../components/learn/widgets/BluffBreakevenExplorer';
import { bluffBreakeven, requiredEquityFromPreBet, BET_SIZE_PRESETS, pct } from '../math';

// Lesson 7 — Bet sizing, alpha & bluffing math. Alpha is defined exactly as
// the generate_mdf() explanation defines it (bet / pot); the sizing table is
// computed from the generator's _BET_SIZES via lessons/math.js.
const SIZING_ROWS = BET_SIZE_PRESETS.map(({ label, fraction }) => ({
  label,
  alpha: fraction.toFixed(2),
  bluffNeeds: pct(bluffBreakeven(1, fraction), 1),
  callerNeeds: pct(requiredEquityFromPreBet(1, fraction), 1),
}));

const BetSizingAlpha = () => (
  <>
    <LessonSection id="why-size-matters" title="Why size matters">
      <p>
        A bet is never just "a bet" — its size decides everything downstream: the price your
        opponent is offered, how often a bluff has to work, and how much value a strong hand can
        extract. Two players can take the same line with the same cards and end up with completely
        different EV purely on sizing. This lesson builds the sizing vocabulary; the MDF lesson
        next door uses it to answer the defender's side in full.
      </p>
    </LessonSection>

    <LessonSection id="alpha" title="Alpha">
      <p>
        Everything about a bet's geometry is captured by one ratio,{' '}
        <strong className="text-white">alpha</strong>:
      </p>
      <Formula note="A half-pot bet has alpha 0.5; a pot-sized bet 1.0; a 2x overbet 2.0. Every formula in this lesson and the next is a function of alpha alone — absolute chip amounts never matter, only the ratio.">
        alpha = bet / pot
      </Formula>
      <p>
        This is why the pot-odds ladder from the previous lesson had fixed answers per sizing, and
        why the tables in this lesson can be memorized once and reused at any stakes.
      </p>
    </LessonSection>

    <LessonSection id="bluff-breakeven" title="The bluff break-even">
      <p>
        A pure bluff — a hand with no chance of winning at showdown — makes money only when the
        opponent folds. Risk B to win the pot P, and the EV equation solves in two lines:
      </p>
      <Formula note="Set EV = 0: F × P − (1 − F) × B = 0, so F = B / (P + B). Note the same shape as required equity — this is the pot-odds formula wearing the bettor's hat.">
        a bluff must work B / (P + B) of the time
      </Formula>
      <WorkedExample title="Worked example: a two-thirds-pot river bluff">
        <Step n={1}>Pot 12 BB. You bluff 8 BB (two-thirds pot, alpha ≈ 0.67).</Step>
        <Step n={2}>
          Break-even fold frequency: 8 / (12 + 8) = <strong className="text-white">40%</strong>.
          If villain folds more than 40% of the time, the bluff prints money even though it{' '}
          <em>never</em> wins at showdown.
        </Step>
        <Step n={3}>
          Notice what this doesn't require: a read, a soul, or a hero. Just an estimate of one
          number — how often they fold — against a threshold set entirely by your sizing.
        </Step>
      </WorkedExample>
      <BluffBreakevenExplorer initialFraction={0.66} />
    </LessonSection>

    <LessonSection id="sizing-families" title="Sizing families">
      <p>
        The standard sizings, with what each demands of the bluffer and offers the caller — both
        columns are pure functions of alpha:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-w-2xl">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-4 font-bold">Bet</th>
              <th className="py-2 pr-4 font-bold">Alpha</th>
              <th className="py-2 pr-4 font-bold">Bluff must work</th>
              <th className="py-2 font-bold">Caller needs equity</th>
            </tr>
          </thead>
          <tbody>
            {SIZING_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-slate-800/60">
                <td className="py-2 pr-4 font-semibold text-slate-200">{row.label}</td>
                <td className="py-2 pr-4 font-mono text-slate-400">{row.alpha}</td>
                <td className="py-2 pr-4 font-mono text-rose-300">{row.bluffNeeds}</td>
                <td className="py-2 font-mono text-indigo-300">{row.callerNeeds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Read it as a menu of trade-offs. <strong className="text-white">Small bets</strong> (⅓-½
        pot) are cheap bluffs that need few folds and let thin value bet safely — but they give the
        caller a great price. <strong className="text-white">Big bets and overbets</strong> demand
        many folds and charge draws their maximum, at the cost of needing to work far more often
        and folding out most worse hands. There is no free sizing; every choice moves both columns
        at once.
      </p>
      <Callout tone="info" title="Why bet at all?">
        <p>
          Sizing presumes a reason to bet: for <em>value</em> (worse hands call), as a{' '}
          <em>bluff</em> (better hands fold), or as a <em>semi-bluff</em> (a draw that wins either
          by folds now or by hitting later). The{' '}
          <Link to="/tutorial" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Fundamentals tutorial
          </Link>{' '}
          covers the three reasons; this lesson prices them.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="bridge-to-mdf" title="The bridge to MDF">
      <p>
        Flip the bluff break-even around and a threat appears: if a 40%-break-even bluff is met by
        an opponent who folds <em>more</em> than 60% of their range... every bluff profits,
        automatically, with any two cards. How often must a range continue to shut that door? That
        exact question — the defender's answer to everything in this lesson — is{' '}
        <strong className="text-white">Minimum Defense Frequency</strong>, and it's next.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Alpha = bet / pot — every sizing formula is a function of this one ratio.',
        'A pure bluff must work B / (P + B) of the time: ½ pot → 33%, pot → 50%, 2x pot → 67%.',
        'The same size sets the caller\'s price: sizing is choosing both numbers at once.',
        'Small bets = cheap bluffs and thin value at a good caller price; big bets = max pressure that must work more often.',
        'If a range folds more than 1 − (bluff break-even), any two cards profit as a bluff — MDF is the defense.',
      ]}
    />
  </>
);

export default BetSizingAlpha;
