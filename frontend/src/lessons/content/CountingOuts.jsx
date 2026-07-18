import React from 'react';
import { LessonSection, Callout, Formula, WorkedExample, Step, KeyTakeaways } from '../../components/learn/primitives';
import OutsGallery from '../../components/learn/widgets/OutsGallery';

// Lesson 3 — Counting outs. The draw catalogue matches the equity generator's
// _DRAW_TEMPLATES exactly (flush 9, OESD 8, gutshot 4, combo 9+8−2=15).
const CountingOuts = () => (
  <>
    <LessonSection id="what-is-an-out" title="What is an out?">
      <p>
        An <strong className="text-white">out</strong> is a card still hidden in the deck that turns
        your losing hand into (what you believe will be) the winning one. Counting them is the first
        half of every drawing decision — the next lesson turns the count into a probability, and the
        one after that compares the probability to the price you're being asked to pay.
      </p>
      <p>
        The denominator matters as much as the count. On the flop you can see exactly 5 cards: your
        2 hole cards and 3 board cards. The other{' '}
        <strong className="text-white">47 are unseen</strong>, and every one of them is equally
        likely to be next off the deck. It makes no difference that some are in opponents' hands or
        in the muck — from your seat, unseen is unseen.
      </p>
      <Formula note="On the turn one more card is visible, so the unseen count drops to 46.">
        unseen on the flop = 52 − 2 (yours) − 3 (board) = 47
      </Formula>
    </LessonSection>

    <LessonSection id="the-standard-draws" title="The standard draws">
      <p>
        Four patterns cover almost every draw you'll ever hold. Learn their out counts cold — the
        equity drills deal these exact shapes:
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-3">
          <span className="text-indigo-400 shrink-0">•</span>
          <span>
            <strong className="text-white">Flush draw — 9 outs.</strong> Four of your suit are
            visible (two in hand, two on board); the other 9 of the 13 complete it.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400 shrink-0">•</span>
          <span>
            <strong className="text-white">Open-ended straight draw — 8 outs.</strong> Four cards in
            a row; either end fills it: two ranks × four suits.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400 shrink-0">•</span>
          <span>
            <strong className="text-white">Gutshot — 4 outs.</strong> Only the single inside rank
            works: one rank × four suits.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400 shrink-0">•</span>
          <span>
            <strong className="text-white">Overcards — about 6 outs.</strong> Two cards above the
            board, hoping to pair either: 3 + 3. Softer than the others — pairing an overcard often
            wins, but nothing is promised.
          </span>
        </li>
      </ul>
      <OutsGallery />
    </LessonSection>

    <LessonSection id="dont-double-count" title="Don't double-count">
      <p>
        The moment you hold two draws at once, naive addition breaks. A flush draw plus an
        open-ended straight draw is <em>not</em> 9 + 8 = 17 outs, because two of the straight cards
        are the same physical cards as two of the flush cards — count them twice and you've invented
        outs that don't exist.
      </p>
      <WorkedExample title="Worked example: T♠9♠ on J♠8♠2♦">
        <Step n={1}>Flush outs: 9 remaining spades.</Step>
        <Step n={2}>Straight outs: any queen or seven — 8 cards.</Step>
        <Step n={3}>
          But <span className="font-mono text-indigo-300">Q♠</span> and{' '}
          <span className="font-mono text-indigo-300">7♠</span> live in both lists (they make a
          straight flush — they're still outs, just <em>one</em> out each). 9 + 8 − 2 ={' '}
          <strong className="text-white">15 clean outs</strong>.
        </Step>
      </WorkedExample>
      <Callout tone="warn" title="The drills test exactly this">
        <p>
          The combo-draw questions in Infinite Practice deliberately offer the 17-out answer as an
          option. Overlap first, then add: list the outs card by card if you're unsure.
        </p>
      </Callout>
    </LessonSection>

    <LessonSection id="dirty-outs" title="Dirty outs">
      <p>
        Not every out is clean. A card that completes your straight while putting a third heart on
        the board may simultaneously complete someone's flush; an out that pairs the board can hand
        a full house to a set. These are <strong className="text-white">dirty (or tainted)
        outs</strong> — they improve your hand and still lose.
      </p>
      <p>
        The honest fix is a discount, not denial: against a likely flush draw, count a
        board-pairing straight out as half an out, or drop it entirely. The drills here grade the
        clean-out arithmetic — dirty-out judgment is a table skill to layer on top once the counting
        is automatic.
      </p>
    </LessonSection>

    <KeyTakeaways
      items={[
        'An out is an unseen card that upgrades you to the winning hand; on the flop there are 47 unseen cards.',
        'The catalogue: flush draw 9, open-ender 8, gutshot 4, overcards ~6.',
        'Combined draws overlap — subtract the shared cards. Flush + open-ender = 9 + 8 − 2 = 15, never 17.',
        'Outs that complete you but likely complete an opponent too are dirty — discount them at the table.',
      ]}
    />
  </>
);

export default CountingOuts;
