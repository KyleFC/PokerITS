import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import MDFSlider from '../../components/learn/widgets/MDFSlider';
import { mdf, requiredEquityFromPreBet, BET_SIZE_PRESETS, pct } from '../math';

// Lesson 8 — Minimum Defense Frequency. The formula and the mirror-concept
// contrast are stated exactly as generate_mdf() explains and grades them;
// the ladder is computed from the generator's _BET_SIZES.
const MDF_ROWS = BET_SIZE_PRESETS.map(({ label, fraction }) => ({
  label,
  mdfPct: pct(mdf(1, fraction), 1),
  foldPct: pct(1 - mdf(1, fraction), 1),
}));

const Mdf = () => (
  <>
    <LessonSection id="the-auto-profit-problem" title="The auto-profit problem">
      <p>
        From the last lesson: a half-pot bluff needs folds a third of the time to break even. Now
        imagine an opponent who folds to half-pot bets 60% of the time.{' '}
        <strong className="text-white">Every bluff against them prints money — with any two
        cards.</strong> No reads required, no hand required; their folding frequency alone is the
        leak, and it pays out on every single bet.
      </p>
      <p>
        Minimum Defense Frequency is the wall against that: the share of your range that must
        continue (call <em>or</em> raise) against a given bet size so that a bluff with zero equity
        can never automatically profit. Defend less, and the opponent doesn't need a hand to beat
        you — they only need chips.
      </p>
    </LessonSection>

    <LessonSection id="the-formula" title="The formula">
      <Formula note="Alpha = bet / pot, from the previous lesson. Note this is 1 minus the bluff break-even: MDF concedes the bluffer exactly their break-even and not one fold more.">
        MDF = 1 / (1 + alpha) = pot / (pot + bet)
      </Formula>
      <WorkedExample title="Worked example: a half-pot river bet">
        <Step n={1}>
          Pot 10 BB, villain bets 5 BB. Alpha = 5 / 10 = 0.5, so MDF = 1 / 1.5 = 10 / 15 ={' '}
          <strong className="text-white">67%</strong>.
        </Step>
        <Step n={2}>
          Reaching the river with 30 combos in your range, at least ~20 must continue against this
          size — fold 15 and you're surrendering 50% when only 33% was for sale.
        </Step>
        <Step n={3}>
          The check: villain's half-pot bluff needs 33% folds to break even, and MDF hands them
          exactly 100% − 67% = 33%. Their zero-equity bluffs make precisely nothing.
        </Step>
      </WorkedExample>
      <MDFSlider initialFraction={0.5} />
    </LessonSection>

    <LessonSection id="mdf-by-size" title="MDF by bet size">
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-w-md">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-4 font-bold">Villain bets</th>
              <th className="py-2 pr-4 font-bold">MDF</th>
              <th className="py-2 font-bold">You may fold</th>
            </tr>
          </thead>
          <tbody>
            {MDF_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-slate-800/60">
                <td className="py-2 pr-4 font-semibold text-slate-200">{row.label}</td>
                <td className="py-2 pr-4 font-mono text-indigo-300">{row.mdfPct}</td>
                <td className="py-2 font-mono text-slate-400">{row.foldPct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The shape to internalize: <strong className="text-white">bigger bets buy the bettor more
        folds</strong>. Against a third-pot stab you defend three-quarters of your range; against a
        2x overbet you're entitled to fold two-thirds of it. Overfolding to <em>small</em> bets is
        the expensive, invisible version of the leak — a third-pot bet only "needs" 25% folds, so
        every extra fold past that line is free money you're handing across the table.
      </p>
    </LessonSection>

    <LessonSection id="mdf-vs-pot-odds" title="MDF vs pot odds — the mirror concepts">
      <p>
        Facing the same bet, the two formulas answer different questions, and the drills love to
        offer each as a distractor for the other:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-5 space-y-2">
          <p className="font-semibold text-sm text-indigo-300">Pot odds — a hand question</p>
          <p className="font-mono text-xs text-slate-300">required equity = B / (P + 2B)</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            "Can <em>this hand</em> call profitably?" Compares one hand's equity to the price.
            Half-pot bet: needs {pct(requiredEquityFromPreBet(1, 0.5), 0)} equity.
          </p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-5 space-y-2">
          <p className="font-semibold text-sm text-emerald-300">MDF — a range question</p>
          <p className="font-mono text-xs text-slate-300">MDF = P / (P + B)</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            "How much of <em>my whole range</em> must continue?" Protects your strategy from
            any-two-cards bluffs. Half-pot bet: defend {pct(mdf(1, 0.5), 0)}.
          </p>
        </div>
      </div>
      <Callout tone="warn" title="Know all three numbers apart">
        <p>
          For a half-pot bet: required equity 25%, MDF 67%, and the <em>surrender frequency</em>{' '}
          1 − MDF = 33%. All three show up as answer options in MDF drills. If the question asks
          about your range, it's MDF; if it asks about one hand's break-even, it's pot odds.
        </p>
      </Callout>
      <p>
        The two work together at the table: MDF tells you <em>how many</em> combos must continue;
        pot odds (plus hand strength and blockers) tell you <em>which ones</em> — your best
        bluff-catchers make the cut, your worst air doesn't.
      </p>
    </LessonSection>

    <LessonSection id="when-to-deviate" title="When to deviate">
      <p>
        MDF is the <strong className="text-white">unexploitable baseline</strong>, not a command.
        It answers "what if my opponent bluffs perfectly?" — but real opponents don't. Against
        someone who bluffs far too rarely (most low-stakes players, and the nit bot in the Arena),
        their big bets are value; folding "too much" loses nothing to bluffs that never come.
        Against an over-bluffer (the maniac), you defend well past MDF, because their bets are
        stuffed with air.
      </p>
      <p>
        Deviate on evidence, deliberately — and know that every step away from MDF opens the
        matching door for them. The baseline is what you return to the moment you're unsure.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'If your range folds too often, zero-equity bluffs auto-profit — MDF is the wall.',
        'MDF = 1 / (1 + alpha) = pot / (pot + bet): ⅓ pot → 75%, ½ pot → 67%, pot → 50%, 2x → 33%.',
        'MDF is a range question; pot odds are a hand question. Same bet, different answers — don\'t swap them.',
        'Overfolding to small bets is the expensive invisible leak: a ⅓-pot bluff only needs 25% folds.',
        'MDF is the unexploitable baseline. Deviate on evidence against under- or over-bluffers, never by default.',
      ]}
    />
  </>
);

export default Mdf;
