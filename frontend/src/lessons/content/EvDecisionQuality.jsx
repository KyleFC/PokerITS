import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import CallEVExplorer from '../../components/learn/widgets/CallEVExplorer';
import { EV_LOSS_THRESHOLDS_BB, PREFLOP_DEVIATION_PENALTY_BB } from '../math';
import { SKILL_LABELS } from '../../constants';

// Lesson 1 — EV & decision quality. The framing lesson: everything this tutor
// does rests on the decision-vs-outcome separation (project.md §1), so it is
// taught first and explicitly.
const THRESHOLD_ROWS = [
  { skill: 'preflop_range', note: `Zero tolerance: any off-chart action is charged a flat ${PREFLOP_DEVIATION_PENALTY_BB} BB penalty and graded incorrect.` },
  { skill: 'pot_odds', note: 'Half a big blind of slack forgives rounding and near-break-even spots.' },
  { skill: 'mdf', note: 'Same tolerance — exact bet-sizing math.' },
  { skill: 'equity_estimation', note: 'Equity misjudgement shows up as an EV-losing call or fold.' },
  { skill: 'implied_odds', note: 'Set-mining pots swing larger, so a wider band avoids penalising thin-but-defensible calls.' },
];

const EvDecisionQuality = () => (
  <>
    <LessonSection id="why-results-lie" title="Why results lie">
      <p>
        You call a river bet with the best hand and lose to a two-outer. Did you play it wrong? You
        shove 72o into aces, spike two pair and drag the pot. Did you play it right? If you answer
        either question by looking at who won, poker will teach you the wrong lessons for the rest
        of your life.
      </p>
      <p>
        <strong className="text-white">Getting a bad card is not the same as making a bad decision.</strong>{' '}
        The card that falls after you act carries no information about whether the action was good —
        it was already sitting face-down in the deck either way. A good decision is one that makes
        money <em>on average</em>, across all the cards that could have come.
      </p>
      <Callout tone="key" title="The rule this whole tutor is built on">
        <p>
          Every decision you make here is graded against a mathematical benchmark <em>at the moment
          you make it</em> — never by the outcome of the hand. In the Arena you can lose a hand and
          be told you played it perfectly, or win one and get flagged for a leak. Both are the
          system working.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="what-is-ev" title="What is EV?">
      <p>
        Expected value (EV) is the long-run average of a decision: each possible result, weighted by
        how often it happens. Offer a coin flip that pays you 2 BB on heads and costs 1 BB on tails,
        and each flip is worth 0.5 × 2 − 0.5 × 1 = <strong className="text-white">+0.5 BB on
        average</strong> — even though no single flip ever pays exactly that. Losing one flip
        doesn't make taking the bet a mistake; refusing it does.
      </p>
      <p>
        Poker is that coin flip with better disguises. Every call, fold and raise has an EV, and
        your job is only ever to pick the action with the highest one. The pot then goes wherever
        the cards say — that part was never under your control.
      </p>
    </LessonSection>

    <LessonSection id="ev-of-a-call" title="The EV of a call">
      <p>
        The one formula this curriculum returns to again and again. When you face a bet, folding
        always has an EV of exactly 0 — you lose nothing more and win nothing. Calling risks the
        bet to win what's already out there:
      </p>
      <Formula note="pot_before_call is everything you stand to win: the pot plus the villain's bet, but not your own call. Folding is the 0 EV baseline; the best action is whichever is higher.">
        EV(call) = equity × pot_before_call − (1 − equity) × bet_to_call
      </Formula>
      <WorkedExample title="Worked example: a half-pot river bet, 40% equity">
        <Step n={1}>
          The pot is 10 BB and villain bets 5 BB. The pot you stand to win is 10 + 5 ={' '}
          <strong className="text-white">15 BB</strong> — careful bookkeeping here is where most
          people slip: your own 5 BB call is <em>not</em> part of what you win.
        </Step>
        <Step n={2}>
          Say your hand is good 40% of the time. EV(call) = 0.40 × 15 − 0.60 × 5 = 6 − 3 ={' '}
          <strong className="text-emerald-400">+3 BB</strong>.
        </Step>
        <Step n={3}>
          Calling is worth +3 BB and folding is worth 0, so calling is right — by 3 BB. Now villain
          rolls over the winner and you muck. The call was still worth +3 BB.{' '}
          <strong className="text-white">You lost the hand and played it perfectly.</strong>
        </Step>
      </WorkedExample>
      <CallEVExplorer initialPot={10} initialBet={5} initialEquity={40} />
    </LessonSection>

    <LessonSection id="how-you-are-graded" title="How you are graded">
      <p>
        In live Arena hands the tutor computes the EV of what you did versus the EV of the best
        available action. The difference is your <strong className="text-white">EV loss</strong> in
        big blinds: 0 means you found the best play; anything above 0 is how much you gave away.
        Each skill then has a documented tolerance — stay at or under it and the decision is
        recorded as correct:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-4 font-bold">Skill</th>
              <th className="py-2 pr-4 font-bold whitespace-nowrap">Correct if EV loss ≤</th>
              <th className="py-2 font-bold">Why</th>
            </tr>
          </thead>
          <tbody>
            {THRESHOLD_ROWS.map(({ skill, note }) => (
              <tr key={skill} className="border-b border-slate-800/60">
                <td className="py-2.5 pr-4 font-semibold text-slate-200 whitespace-nowrap">{SKILL_LABELS[skill]}</td>
                <td className="py-2.5 pr-4 font-mono text-indigo-300 whitespace-nowrap">
                  {EV_LOSS_THRESHOLDS_BB[skill].toFixed(1)} BB
                </td>
                <td className="py-2.5 text-slate-400 text-xs leading-relaxed">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Notice what's absent from that table: whether you won. Chips won and lost never feed your
        mastery estimate — only decision quality does.
      </p>
    </LessonSection>

    <LessonSection id="variance" title="Living with variance">
      <p>
        Variance is the gap between EV and any single result. It is enormous in poker: a perfect
        session can lose buy-ins, and a terrible one can double up. Over a handful of hands, results
        are nearly all noise; only over thousands do they converge toward EV.
      </p>
      <p>
        That's why the Arena stats page leads with your <em>EV trend</em> and shows chip results
        second, smaller, and labeled as variance. A downswing under a flat EV line means you ran
        bad, not that you played bad. Read your graphs in that order, always: decisions first,
        results as weather.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'Judge every decision by its math at the moment you act — the next card is not feedback.',
        'EV(call) = equity × pot_before_call − (1 − equity) × bet_to_call; folding is always exactly 0 EV.',
        'The pot you win never includes your own call — the most common bookkeeping slip.',
        'The tutor grades EV loss against documented per-skill tolerances; winning or losing the hand never feeds your mastery.',
        'Results tell you about variance. Decisions tell you about skill. Only one of them is yours to control.',
      ]}
    />
  </>
);

export default EvDecisionQuality;
