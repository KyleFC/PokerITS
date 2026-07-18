import React, { useState, useEffect } from 'react';
import {
  RefreshCw, XCircle, Grid3x3, Info, Shuffle, Check, RotateCcw, ArrowLeft, Target,
} from 'lucide-react';
import { pokerService } from '../services/api';
import PageLayout from '../components/PageLayout';
import PokerCard from '../components/PokerCard';

// Ranks in grid order (top-left = AA).
const RANKS = 'AKQJT98765432'.split('');
const SUITS = ['s', 'h', 'd', 'c'];

// The 169-class label at a grid cell: diagonal = pairs, above = suited,
// below = offsuit — the standard range-matrix convention, high card first.
const handClassAt = (row, col) => {
  if (row === col) return RANKS[row] + RANKS[col];
  if (row < col) return RANKS[row] + RANKS[col] + 's';
  return RANKS[col] + RANKS[row] + 'o';
};

// Deal two concrete random cards, uniformly from the 52-card deck, so class
// frequencies match real play (offsuit junk shows up often — that's the drill).
const dealHoleCards = () => {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  const i = Math.floor(Math.random() * 52);
  let j = Math.floor(Math.random() * 51);
  if (j >= i) j += 1;
  let [hi, lo] = [deck[i], deck[j]];
  if (RANKS.indexOf(hi[0]) > RANKS.indexOf(lo[0])) [hi, lo] = [lo, hi];
  const klass = hi[0] === lo[0] ? hi[0] + lo[0] : hi[0] + lo[0] + (hi[1] === lo[1] ? 's' : 'o');
  return { cards: [hi, lo], klass };
};

// Segment order matches GTO viewers: most aggressive action first.
const ACTION_ORDER = ['allin', 'raise', 'call', 'fold'];

const ACTION_META = {
  allin: { label: 'All-In', color: '#7f1d1d', text: 'text-white' },
  raise: { label: 'Raise', color: '#f43f5e', text: 'text-white' },
  call: { label: 'Call / Limp', color: '#10b981', text: 'text-white' },
  defend: { label: 'Defend (Call / 3-Bet)', color: '#10b981', text: 'text-white' },
  fold: { label: 'Fold', color: '#1e293b', text: 'text-slate-600' },
};

// Full {allin, raise, call, fold} mix for a hand; the API sends mixed charts
// sparsely (absent hand = always fold, absent action = 0%).
const mixFor = (position, klass) => {
  const m = position.mixed?.[klass] ?? {};
  const allin = m.allin ?? 0;
  const raise = m.raise ?? 0;
  const call = m.call ?? 0;
  return { allin, raise, call, fold: Math.max(0, 1 - allin - raise - call) };
};

const simpleActionFor = (position, klass) => {
  for (const [action, hands] of Object.entries(position.simple)) {
    if (hands.includes(klass)) return action;
  }
  return 'fold';
};

// Advanced-tier grading. Leeway: every action within 25 points passes, and a
// pure answer on the chart's majority action always passes — a student who
// learned the simple (binary) tier is never punished here.
const gradeAnswer = (user, actual) => {
  const errs = ACTION_ORDER.map((a) => Math.abs(user[a] - actual[a] * 100));
  const maxErr = Math.max(...errs);
  const majority = ACTION_ORDER.reduce((best, a) => (actual[a] > actual[best] ? a : best));
  const pureOnMajority = user[majority] === 100;
  const pass = maxErr <= 25 || pureOnMajority;
  const verdict = maxErr <= 10 ? 'spot-on' : pass ? 'close' : 'off';
  return { pass, verdict, maxErr: Math.round(maxErr) };
};

// One grid cell. Simple tier: solid color by rounded action. Advanced tier:
// GTO-viewer-style proportional color segments, left to right.
const RangeCell = ({ klass, position, advanced, isPair }) => {
  let style;
  let textClass;
  let title;
  if (advanced) {
    const mix = mixFor(position, klass);
    const stops = [];
    let at = 0;
    for (const action of ACTION_ORDER) {
      if (mix[action] <= 0) continue;
      const end = at + mix[action] * 100;
      stops.push(`${ACTION_META[action].color} ${at}% ${end}%`);
      at = end;
    }
    style = { background: `linear-gradient(to right, ${stops.join(', ')})` };
    textClass = mix.fold > 0.85 ? 'text-slate-500' : 'text-white';
    title = `${klass} — ` + ACTION_ORDER
      .filter((a) => mix[a] > 0)
      .map((a) => `${ACTION_META[a].label} ${Math.round(mix[a] * 100)}%`)
      .join(', ');
  } else {
    const action = simpleActionFor(position, klass);
    style = { background: ACTION_META[action].color };
    textClass = ACTION_META[action].text;
    title = `${klass} — ${ACTION_META[action].label}`;
  }

  return (
    <div
      title={title}
      style={style}
      className={`aspect-square rounded-[4px] flex items-center justify-center
        text-[9px] sm:text-[11px] md:text-xs font-semibold tracking-tight select-none
        ${textClass}
        ${isPair ? 'ring-1 ring-inset ring-white/10' : ''}`}
    >
      {klass}
    </div>
  );
};

// Horizontal stacked bar of an action mix (0..100 per action).
const MixBar = ({ mix }) => (
  <div className="w-full h-4 rounded-md overflow-hidden flex bg-slate-800">
    {ACTION_ORDER.map((a) =>
      mix[a] > 0 ? (
        <div key={a} style={{ width: `${mix[a]}%`, background: ACTION_META[a].color }} />
      ) : null
    )}
  </div>
);

// Test mode: the chart is hidden and the student sees only two dealt cards —
// they have to visualize where the hand sits in the chart. Sliders for
// All-In / Raise / Call; Fold auto-fills the remainder. The hand class is
// revealed only after checking.
// Parent remounts this via `key` on each new deal/position, so local state
// starts fresh — no reset-on-prop-change effect (which would render one stale
// frame against the new cards before clearing).
const HoleCardQuiz = ({ position, deal, onNewHand, onExit }) => {
  const [sliders, setSliders] = useState({ allin: 0, raise: 0, call: 0 });
  const [result, setResult] = useState(null);

  const foldPct = 100 - sliders.allin - sliders.raise - sliders.call;
  const userMix = { ...sliders, fold: foldPct };
  const actual = mixFor(position, deal.klass);

  const setSlider = (action, raw) => {
    const others = Object.entries(sliders)
      .filter(([a]) => a !== action)
      .reduce((sum, [, v]) => sum + v, 0);
    setSliders({ ...sliders, [action]: Math.min(Number(raw), 100 - others) });
  };

  const check = () => setResult(gradeAnswer(userMix, actual));

  const verdictText = {
    'spot-on': 'Spot on — within 10 points of the solver mix.',
    close: 'Close enough — inside the leeway window.',
    off: 'Off — compare your mix against the solver below.',
  };
  const verdictColor = {
    'spot-on': 'text-emerald-300',
    close: 'text-emerald-300',
    off: 'text-rose-300',
  };

  return (
    <section className="max-w-xl mx-auto bg-slate-900/50 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to chart
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
          Test yourself
        </span>
      </div>

      <p className="text-center text-sm text-slate-400 font-medium mb-4">
        You're dealt this in the{' '}
        <span className="text-slate-200 font-bold">{position.name} ({position.code})</span>.
        How does the solver play it?
      </p>

      {/* The dealt hand — no chart, no class label until checked. */}
      <div className="flex justify-center gap-3 mb-2 scale-[1.6] my-8">
        <PokerCard value={deal.cards[0]} />
        <PokerCard value={deal.cards[1]} />
      </div>
      <p className="text-center text-xs text-slate-500 font-semibold mb-6 h-4">
        {result ? (
          <>
            That's <span className="text-indigo-300 font-mono">{deal.klass}</span> on the chart.
          </>
        ) : (
          ' '
        )}
      </p>

      <div className="space-y-4">
        {['allin', 'raise', 'call'].map((action) => (
          <div key={action}>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-slate-300">{ACTION_META[action].label}</span>
              <span className="text-slate-400">{sliders[action]}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={sliders[action]}
              disabled={!!result}
              onChange={(e) => setSlider(action, e.target.value)}
              className="w-full"
              style={{ accentColor: ACTION_META[action].color }}
            />
          </div>
        ))}
        <div className="flex justify-between text-xs font-bold">
          <span className="text-slate-300">{ACTION_META.fold.label} (remainder)</span>
          <span className="text-slate-400">{foldPct}%</span>
        </div>
        <MixBar mix={userMix} />
      </div>

      {!result ? (
        <button
          onClick={check}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-xl transition"
        >
          <Check className="h-4 w-4" /> Check
        </button>
      ) : (
        <div className="mt-6 space-y-4">
          <p className={`text-sm font-bold ${verdictColor[result.verdict]}`}>
            {verdictText[result.verdict]}
            <span className="text-slate-500 font-semibold"> (max error {result.maxErr} pts)</span>
          </p>
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">Solver mix</p>
            <MixBar
              mix={{
                allin: actual.allin * 100,
                raise: actual.raise * 100,
                call: actual.call * 100,
                fold: actual.fold * 100,
              }}
            />
            <p className="text-xs text-slate-500 mt-1.5 font-medium">
              {ACTION_ORDER.filter((a) => actual[a] > 0)
                .map((a) => `${ACTION_META[a].label} ${Math.round(actual[a] * 100)}%`)
                .join(' · ')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setSliders({ allin: 0, raise: 0, call: 0 }); setResult(null); }}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold py-2.5 rounded-xl transition"
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </button>
            <button
              onClick={onNewHand}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-xl transition"
            >
              <Shuffle className="h-4 w-4" /> New hand
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const RangeCharts = ({ user, onLogout }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [format, setFormat] = useState('six_max');
  const [difficulty, setDifficulty] = useState('simple');
  const [positionCode, setPositionCode] = useState(null);
  const [deal, setDeal] = useState(null); // non-null => test mode, chart hidden

  useEffect(() => {
    pokerService
      .getPreflopRanges()
      .then(setData)
      .catch(() => setError('Failed to load the preflop charts. Please try again.'));
  }, []);

  const group = data?.[format];
  const positions = group?.positions ?? [];
  const position =
    positions.find((p) => p.code === positionCode) ?? positions[0] ?? null;
  // Advanced tier exists only where the API supplies mixed frequencies.
  const advanced = difficulty === 'advanced' && !!position?.mixed;
  const testing = advanced && !!deal;

  const selectFormat = (f) => { setFormat(f); setPositionCode(null); setDeal(null); };
  const selectPosition = (code) => setPositionCode(code);
  const selectDifficulty = (d) => { setDifficulty(d); setDeal(null); };

  if (error) {
    return (
      <PageLayout onLogout={onLogout} user={user}>
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      </PageLayout>
    );
  }

  if (!data) {
    return (
      <PageLayout onLogout={onLogout} user={user}>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-slate-400 font-medium">Loading range charts...</p>
        </div>
      </PageLayout>
    );
  }

  const legendActions = advanced
    ? ACTION_ORDER.filter((a) =>
        a !== 'fold' ? Object.values(position.mixed ?? {}).some((m) => (m[a] ?? 0) > 0) : true)
    : [...position.actions, 'fold'];

  const subtitle = position.actions.includes('call')
    ? `Open to ${position.open_raise_size_bb} BB, limp, or fold`
    : position.actions.includes('defend')
      ? `Continue vs a ${position.open_raise_size_bb} BB Button open, otherwise fold`
      : `Raise first in to ${position.open_raise_size_bb} BB, otherwise fold`;

  const playedCount = Object.values(position.simple).reduce((n, hands) => n + hands.length, 0);

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Header */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-slate-800 border border-slate-700 p-2.5 rounded-lg">
            <Grid3x3 className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Preflop Range Charts
          </h2>
        </div>
        <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
          Charts tuned to GTO Wizard 6-max solutions. Simple mode rounds every hand to one
          action — the version the tutor grades you against. Advanced mode shows the solver's
          true mixed frequencies, and lets you test your feel for the ratios.
        </p>
      </section>

      {/* Format / difficulty / position selectors */}
      <section className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            {[['six_max', '6-Max'], ['heads_up', 'Heads-Up']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => selectFormat(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  format === key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {format === 'six_max' && (
            <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
              {[['simple', 'Simple'], ['advanced', 'Advanced']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => selectDifficulty(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    difficulty === key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {positions.map((p) => (
            <button
              key={p.code}
              onClick={() => selectPosition(p.code)}
              className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                p.code === position.code
                  ? 'bg-slate-800 border-indigo-500/60 text-white shadow'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {p.code}
              <span className="ml-2 text-xs font-semibold text-slate-500">
                {(p.fraction * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>

        {advanced && !testing && (
          <button
            onClick={() => setDeal(dealHoleCards())}
            className="lg:ml-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-500/20"
          >
            <Target className="h-4 w-4" /> Test yourself
          </button>
        )}
      </section>

      {testing ? (
        <HoleCardQuiz
          key={`${position.code}:${deal.cards.join('')}`}
          position={position}
          deal={deal}
          onNewHand={() => setDeal(dealHoleCards())}
          onExit={() => setDeal(null)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* The 13x13 matrix */}
          <section className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {position.name}{' '}
                  <span className="text-slate-500 font-semibold">({position.code})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
                {legendActions.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACTION_META[a].color }} />
                    {ACTION_META[a].label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-[3px] select-none" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
              {RANKS.map((_, row) =>
                RANKS.map((__, col) => {
                  const klass = handClassAt(row, col);
                  return (
                    <RangeCell
                      key={klass}
                      klass={klass}
                      position={position}
                      advanced={advanced}
                      isPair={row === col}
                    />
                  );
                })
              )}
            </div>

            <p className="text-center text-xs text-slate-500 mt-4 font-medium">
              {advanced ? (
                <>Cell colors show the solver's action split.</>
              ) : (
                <>
                  {playedCount} of 169 hand classes played —{' '}
                  <span className="text-slate-300 font-bold">{(position.fraction * 100).toFixed(1)}%</span>{' '}
                  of all starting combos
                </>
              )}
            </p>
          </section>

          {/* Sidebar explainers */}
          <section className="space-y-6">
            {advanced ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-slate-100">Advanced mode</h3>
                </div>
                <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                  <p>
                    Real solver output rarely plays a hand one way every time — borderline hands
                    are mixed between actions at specific ratios. Each cell shows that split.
                  </p>
                  <p>
                    Study the shape, then hit{' '}
                    <span className="text-slate-200 font-semibold">Test yourself</span>: the
                    chart disappears, you're dealt real hole cards, and you set the ratios from
                    memory. You pass if every action is within 25 points — or if you go 100% on
                    the hand's main action, so simple-mode knowledge always counts.
                  </p>
                  <button
                    onClick={() => setDeal(dealHoleCards())}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2.5 rounded-xl transition"
                  >
                    <Target className="h-4 w-4" /> Test yourself
                  </button>
                  <p className="text-xs text-slate-500">
                    Frequencies are eyeball estimates from GTO Wizard NL25 solutions, quantized
                    to ~5% — treat them as a study guide, not gospel.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-slate-100">Reading the grid</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-400 leading-relaxed">
                  <li>
                    <span className="text-slate-200 font-semibold">Diagonal</span> — pocket pairs
                    (AA down to 22), 6 combos each.
                  </li>
                  <li>
                    <span className="text-slate-200 font-semibold">Above the diagonal</span> —
                    suited hands (<span className="font-mono text-slate-300">s</span>), 4 combos
                    each. Suitedness adds flush and playability value, so suited ranges stretch
                    much further right.
                  </li>
                  <li>
                    <span className="text-slate-200 font-semibold">Below the diagonal</span> —
                    offsuit hands (<span className="font-mono text-slate-300">o</span>), 12
                    combos each. They're the bulk of the deck but the weakest part of it.
                  </li>
                  {position.code === 'SB' && format === 'six_max' && (
                    <li>
                      <span className="text-emerald-300 font-semibold">The SB is different</span> —
                      it closes the preflop action at a discount, so the chart mixes big opens
                      (3.5 BB) with limps instead of pure raise-or-fold.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {format === 'six_max' ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-100 mb-4">Position matters</h3>
                <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                  <p>The later you act, the fewer players are left to wake up with a big hand:</p>
                  <ul className="space-y-2">
                    {positions.map((p) => (
                      <li key={p.code} className="flex items-center gap-3">
                        <span className="w-12 shrink-0 font-bold text-slate-300">{p.code}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${p.fraction * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-bold text-slate-300">
                          {(p.fraction * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500">
                    SB's number is hands played (raise + limp), not opens — it defends its posted
                    blind at a discount, which is why it dwarfs the Button.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-100 mb-4">Why so wide?</h3>
                <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
                  <p>
                    Heads-up, the Button posts the small blind, acts first preflop, and has
                    position on every later street — so it opens roughly{' '}
                    <span className="text-slate-200 font-semibold">
                      {((positions.find((p) => p.code === 'SB')?.fraction ?? 0) * 100).toFixed(0)}%
                    </span>{' '}
                    of hands.
                  </p>
                  <p>
                    The Big Blind already has money in and closes the action, so it defends
                    nearly as wide (
                    <span className="text-slate-200 font-semibold">
                      {((positions.find((p) => p.code === 'BB')?.fraction ?? 0) * 100).toFixed(0)}%
                    </span>
                    ) by calling or 3-betting. Folding too much here leaks EV fastest.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </PageLayout>
  );
};

export default RangeCharts;
