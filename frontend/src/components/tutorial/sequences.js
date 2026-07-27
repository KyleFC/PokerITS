// Scripts for the Game Basics animations. Each step is a *partial* frame that
// is merged onto the one before it, so a script reads as "what changed", and
// one hand's story runs continuously across the four street animations:
// you hold A♠ K♦, the board runs out K♣ 9♥ 4♠ / T♦ / 2♣.

const EMPTY_FRAME = {
  heroCards: [],
  dealt: [],
  board: [],
  pot: 0,
  bets: {},
  badges: {},
  folded: [],
  actor: null,
  highlight: null,
  caption: '',
};

export const buildFrames = (steps) => {
  let prev = EMPTY_FRAME;
  return steps.map((step) => {
    // `highlight` is a one-step spotlight; everything else persists until a
    // later step overwrites it.
    prev = { ...prev, ...step, highlight: step.highlight ?? null };
    return prev;
  });
};

// Six-max, hero first (bottom of the table) and the rest clockwise from there.
// Under-the-gun is the first seat after the big blind, so putting the student
// there makes "action starts left of the big blind" literally true on screen.
export const SEATS = [
  { id: 'You', label: 'You', sub: 'UTG' },
  { id: 'MP', label: 'MP' },
  { id: 'CO', label: 'CO' },
  { id: 'BTN', label: 'BTN' },
  { id: 'SB', label: 'SB' },
  { id: 'BB', label: 'BB' },
];

export const HERO = 'You';
export const BUTTON = 'BTN';

const HERO_CARDS = ['As', 'Kd'];
const FLOP = ['Kc', '9h', '4s'];
const TURN = [...FLOP, 'Td'];
const RIVER = [...TURN, '2c'];

export const DEAL_FRAMES = buildFrames([
  {
    caption: 'Six players. The white D is the dealer button — it moves one seat clockwise after every hand.',
    hold: 2400,
  },
  {
    caption: 'Two forced bets go in first: the small blind posts 0.5 BB, the big blind 1 BB. That is the pot everyone is playing for.',
    bets: { SB: 0.5, BB: 1 },
    pot: 1.5,
    hold: 3000,
  },
  {
    caption: 'You are dealt two private cards — your hole cards. Nobody else ever sees them.',
    heroCards: HERO_CARDS,
    highlight: 'hero',
    hold: 2800,
  },
  {
    caption: 'Everyone else gets two as well, face down to you. (At a real table the dealer sends them out one at a time, twice around.)',
    dealt: ['MP', 'CO', 'BTN', 'SB', 'BB'],
    hold: 3200,
  },
  {
    caption: 'Action starts with the first player left of the big blind — that is you — and then moves clockwise around the table.',
    actor: 'You',
    hold: 3000,
  },
]);

// Preflop is over: CO, SB and BB folded, so You, MP and BTN see the flop.
const POSTFLOP_BASE = {
  heroCards: HERO_CARDS,
  dealt: ['MP', 'BTN'],
  folded: ['CO', 'SB', 'BB'],
  pot: 6,
};

export const FLOP_FRAMES = buildFrames([
  {
    ...POSTFLOP_BASE,
    caption: 'Preflop betting is done. Three players are still in and the pot is 6 BB.',
    hold: 2400,
  },
  {
    caption: 'The flop: three community cards dealt face up in the middle. Every player shares them.',
    board: FLOP,
    highlight: 'board',
    hold: 3000,
  },
  {
    caption: 'Build the best five-card hand from your two plus the shared three: A♠ K♦ with the K♣ gives you a pair of kings.',
    highlight: 'hero',
    hold: 3400,
  },
  {
    caption: 'Then a fresh round of betting opens — after the flop the earliest remaining seat acts first, and action moves clockwise again.',
    actor: 'You',
    hold: 3000,
  },
]);

export const TURN_FRAMES = buildFrames([
  {
    ...POSTFLOP_BASE,
    board: FLOP,
    caption: 'Flop betting is complete and the pot has grown to 14 BB.',
    pot: 14,
    hold: 2400,
  },
  {
    caption: 'The turn: a fourth community card, again face up for everyone.',
    board: TURN,
    highlight: 'board',
    hold: 2800,
  },
  {
    caption: 'Six cards are now available to you — your two plus the four shared — but only your best five count.',
    highlight: 'hero',
    hold: 3200,
  },
]);

export const RIVER_FRAMES = buildFrames([
  {
    ...POSTFLOP_BASE,
    board: TURN,
    caption: 'One card left to come. The pot is up to 26 BB.',
    pot: 26,
    hold: 2400,
  },
  {
    caption: 'The river: the fifth and final community card. No more cards after this one.',
    board: RIVER,
    highlight: 'board',
    hold: 2800,
  },
  {
    caption: 'Seven cards are available, best five plays: A♠ K♦ + K♣ 9♥ 4♠ T♦ 2♣ is a pair of kings with an ace kicker.',
    highlight: 'hero',
    hold: 3400,
  },
  {
    caption: 'After the last bets are matched, everyone still in turns their cards over — the showdown — and the best hand takes the pot.',
    pot: 34,
    hold: 3000,
  },
]);

// --- What each action does -------------------------------------------------
// Each script sets up its own spot, because the actions are not all legal in
// the same one: you can only check when nobody has bet, and you can only call
// or raise when somebody has.

const ACTION_BASE = {
  ...POSTFLOP_BASE,
  board: FLOP,
};

export const ACTIONS = [
  {
    id: 'fold',
    label: 'Fold',
    blurb: 'Give up the hand',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'MP bets 3 BB. To keep playing, you have to put 3 BB in.',
        bets: { MP: 3 },
        pot: 9,
        actor: 'You',
        hold: 2800,
      },
      {
        caption: 'Fold — you throw your cards away. It costs you nothing more, but anything you already put in stays in the pot and you can no longer win it.',
        heroCards: [],
        badges: { You: 'Fold' },
        folded: ['CO', 'SB', 'BB', 'You'],
        actor: null,
        hold: 3600,
      },
      {
        caption: 'Action moves clockwise to the next player still in the hand, who faces the same 3 BB.',
        actor: 'BTN',
        hold: 3000,
      },
    ]),
  },
  {
    id: 'check',
    label: 'Check',
    blurb: 'Pass, for free',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'Nobody has bet yet, so staying in the hand costs you nothing.',
        actor: 'You',
        hold: 2600,
      },
      {
        caption: 'Check — you stay in and pass the decision along without putting money in. Only legal when there is no bet to match.',
        badges: { You: 'Check' },
        actor: null,
        hold: 3400,
      },
      {
        caption: 'Action moves clockwise. If someone behind you bets, it comes back around and you can still fold, call or raise.',
        actor: 'MP',
        hold: 3200,
      },
    ]),
  },
  {
    id: 'call',
    label: 'Call',
    blurb: 'Match the bet',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'MP bets 3 BB into the 6 BB pot.',
        bets: { MP: 3 },
        pot: 9,
        actor: 'You',
        hold: 2600,
      },
      {
        caption: 'Call — you match the 3 BB exactly, no more. You are still in the hand and the pot is now 12 BB.',
        bets: { MP: 3, You: 3 },
        pot: 12,
        badges: { You: 'Call' },
        actor: null,
        hold: 3400,
      },
      {
        caption: 'Action moves clockwise to BTN, who now has to put in the same 3 BB, raise, or fold.',
        actor: 'BTN',
        hold: 3200,
      },
    ]),
  },
  {
    id: 'bet',
    label: 'Bet',
    blurb: 'Put in the first chips',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'The flop is out and nobody has bet — the pot is 6 BB and it is your turn.',
        actor: 'You',
        hold: 2600,
      },
      {
        caption: 'Bet — you pick the size yourself (4 BB here). Now nobody plays on for free: everyone left must call 4, raise, or fold.',
        bets: { You: 4 },
        pot: 10,
        badges: { You: 'Bet' },
        actor: null,
        hold: 3600,
      },
      {
        caption: 'Action moves clockwise. If everyone folds, you win the pot right here without showing your cards.',
        actor: 'MP',
        hold: 3200,
      },
    ]),
  },
  {
    id: 'raise',
    label: 'Raise',
    blurb: 'Increase the bet',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'MP bets 3 BB.',
        bets: { MP: 3 },
        pot: 9,
        actor: 'You',
        hold: 2400,
      },
      {
        caption: 'Raise — instead of just matching, you increase it to 10 BB. Everyone still in has to answer the new price, MP included.',
        bets: { MP: 3, You: 10 },
        pot: 19,
        badges: { You: 'Raise' },
        actor: null,
        hold: 3600,
      },
      {
        caption: 'Action moves clockwise, and when it gets back to MP they must call 7 more, raise again, or fold.',
        actor: 'BTN',
        hold: 3200,
      },
    ]),
  },
  {
    id: 'allin',
    label: 'All-In',
    blurb: 'Push your whole stack',
    frames: buildFrames([
      {
        ...ACTION_BASE,
        caption: 'MP bets 3 BB and you have 18 BB left in front of you.',
        bets: { MP: 3 },
        pot: 9,
        actor: 'You',
        hold: 2800,
      },
      {
        caption: 'All-in — you push your entire remaining stack. Nobody can bet you off the hand now, but you cannot put in any more this hand either.',
        bets: { MP: 3, You: 18 },
        pot: 27,
        badges: { You: 'All-In' },
        actor: null,
        hold: 3600,
      },
      {
        caption: 'Action moves clockwise. If someone calls, the rest of the board is dealt out and the hands are compared at showdown.',
        actor: 'BTN',
        hold: 3200,
      },
    ]),
  },
];
