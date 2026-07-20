// Learning Center curriculum metadata — pure data, no component imports, so
// any page (QuizResultPanel, Analytics, Dashboard...) can build lesson links
// without pulling lesson bodies into its bundle. Lesson components live in
// registry.jsx, keyed by the same slugs; meta.test.js keeps the two in sync.
//
// Array order IS the recommended curriculum order (drives hub numbering and
// the Prev/Next footer). `skill` ties a lesson to a BKT skill key (null for
// supporting-concept lessons); `sections` drive the sidebar and the stable
// `#anchor` ids that quiz feedback and the future LLM tutor deep-link to.
import {
  Scale, Grid3x3, Layers, Percent, Divide, Coins, Crosshair, ShieldCheck,
} from 'lucide-react';

export const LESSONS = [
  {
    slug: 'ev-and-decision-quality',
    title: 'EV: Judge the Decision, Not the Card',
    shortTitle: 'EV & Decision Quality',
    skill: null,
    icon: Scale,
    prereqs: [],
    summary:
      'Why this tutor grades your decisions instead of your results, the expected-value math behind every grade, and how to stop variance from lying to you.',
    sections: [
      { id: 'why-results-lie', title: 'Why results lie' },
      { id: 'what-is-ev', title: 'What is EV?' },
      { id: 'ev-of-a-call', title: 'The EV of a call' },
      { id: 'how-you-are-graded', title: 'How you are graded' },
      { id: 'variance', title: 'Living with variance' },
    ],
  },
  {
    slug: 'preflop-ranges',
    title: 'Preflop Ranges: The First Decision',
    shortTitle: 'Preflop Ranges',
    skill: 'preflop_range',
    icon: Grid3x3,
    prereqs: ['ev-and-decision-quality'],
    summary:
      'The 169-hand grid, why position sets how wide you open, raise-or-fold discipline, and the boundary hands where the real learning happens.',
    sections: [
      { id: 'why-ranges', title: 'Why ranges?' },
      { id: 'the-169-grid', title: 'The 169-hand grid' },
      { id: 'position-and-width', title: 'Position sets your width' },
      { id: 'raise-or-fold', title: 'Raise or fold' },
      { id: 'boundary-hands', title: 'Boundary hands' },
    ],
  },
  {
    slug: 'counting-outs',
    title: 'Counting Outs',
    shortTitle: 'Counting Outs',
    skill: null,
    icon: Layers,
    prereqs: ['ev-and-decision-quality'],
    summary:
      'What an out is, the standard draw catalogue, and the double-counting trap in combo draws — the raw material every equity estimate is built from.',
    sections: [
      { id: 'what-is-an-out', title: 'What is an out?' },
      { id: 'the-standard-draws', title: 'The standard draws' },
      { id: 'dont-double-count', title: "Don't double-count" },
      { id: 'dirty-outs', title: 'Dirty outs' },
    ],
  },
  {
    slug: 'equity-estimation',
    title: 'Equity & the Rule of 2 and 4',
    shortTitle: 'Equity Estimation',
    skill: 'equity_estimation',
    icon: Percent,
    prereqs: ['counting-outs'],
    summary:
      'Turn an out count into a win probability at the table: exact math, the rule of 2 and 4, and where the shortcut bends.',
    sections: [
      { id: 'what-is-equity', title: 'What is equity?' },
      { id: 'one-street', title: 'One card to come' },
      { id: 'two-streets', title: 'Two cards to come' },
      { id: 'rule-accuracy', title: 'How accurate is the rule?' },
      { id: 'from-outs-to-decisions', title: 'From outs to decisions' },
    ],
  },
  {
    slug: 'pot-odds',
    title: 'Pot Odds & Required Equity',
    shortTitle: 'Pot Odds',
    skill: 'pot_odds',
    icon: Divide,
    prereqs: ['equity-estimation'],
    summary:
      'The price of a call: required break-even equity, the ladder of common bet sizes, and the three classic mistakes almost everyone makes.',
    sections: [
      { id: 'the-price-of-a-call', title: 'The price of a call' },
      { id: 'required-equity', title: 'Required equity' },
      { id: 'common-mistakes', title: 'Common mistakes' },
      { id: 'putting-it-together', title: 'Putting it together' },
    ],
  },
  {
    slug: 'implied-odds',
    title: 'Implied Odds & Set Mining',
    shortTitle: 'Implied Odds',
    skill: 'implied_odds',
    icon: Coins,
    prereqs: ['pot-odds'],
    summary:
      'When future winnings justify a call the direct price never could — set-mining math, the 15-20x rule, and reverse implied odds.',
    sections: [
      { id: 'beyond-direct-odds', title: 'Beyond direct odds' },
      { id: 'set-mining-math', title: 'Set-mining math' },
      { id: 'the-15-20x-rule', title: 'The 15-20x rule' },
      { id: 'reverse-implied-odds', title: 'Reverse implied odds' },
    ],
  },
  {
    slug: 'bet-sizing-and-alpha',
    title: 'Bet Sizing, Alpha & Bluffing Math',
    shortTitle: 'Bet Sizing & Alpha',
    skill: null,
    icon: Crosshair,
    prereqs: ['pot-odds'],
    summary:
      'What a bet size offers the bettor and demands of the defender: alpha, the bluff break-even, and the standard sizing families.',
    sections: [
      { id: 'why-size-matters', title: 'Why size matters' },
      { id: 'alpha', title: 'Alpha' },
      { id: 'bluff-breakeven', title: 'The bluff break-even' },
      { id: 'sizing-families', title: 'Sizing families' },
      { id: 'bridge-to-mdf', title: 'The bridge to MDF' },
    ],
  },
  {
    slug: 'mdf',
    title: 'Minimum Defense Frequency',
    shortTitle: 'MDF',
    skill: 'mdf',
    icon: ShieldCheck,
    prereqs: ['bet-sizing-and-alpha'],
    summary:
      'How often your range must continue against a bet so bluffs can never auto-profit — and why MDF is the mirror image of pot odds, not the same thing.',
    sections: [
      { id: 'the-auto-profit-problem', title: 'The auto-profit problem' },
      { id: 'the-formula', title: 'The formula' },
      { id: 'mdf-by-size', title: 'MDF by bet size' },
      { id: 'mdf-vs-pot-odds', title: 'MDF vs pot odds' },
      { id: 'when-to-deviate', title: 'When to deviate' },
    ],
  },
];

export const LESSON_BY_SLUG = Object.fromEntries(LESSONS.map((l) => [l.slug, l]));

// BKT skill key -> its lesson. Every entry in GENERATABLE_SKILLS has one
// (pinned by meta.test.js); consumers must still guard unknown skills.
export const LESSON_BY_SKILL = Object.fromEntries(
  LESSONS.filter((l) => l.skill).map((l) => [l.skill, l])
);
