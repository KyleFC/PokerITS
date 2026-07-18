import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Swords, RefreshCw, XCircle, TrendingUp, TrendingDown, Trophy, Frown, Minus, BarChart3 } from 'lucide-react';
import { pokerService } from '../services/api';
import { SKILL_LABELS } from '../constants';
import PageLayout from '../components/PageLayout';
import PokerTable from '../components/PokerTable';
import ActionBar from '../components/ActionBar';

// Heads-up seat layout is fixed server-side: index 0 = BB (bot), 1 = SB/Button
// (hero). The button chip sits on the hero.
const SEATS = ['BB', 'SB'];
const HERO = 'SB';
const BUTTON = 'SB';

// The four bot profiles mirror poker_engine.bot_strategy.BOT_PROFILES; each
// leaks in a way that maps onto a skill the ITS teaches.
const PROFILES = [
  { key: 'balanced', label: 'Balanced', blurb: 'A fair baseline with few leaks.' },
  { key: 'nit', label: 'The Nit', blurb: 'Over-folds — punish by betting and bluffing.' },
  { key: 'station', label: 'Calling Station', blurb: 'Never folds — punish by value-betting thin.' },
  { key: 'maniac', label: 'The Maniac', blurb: 'Over-bluffs — punish by calling down.' },
];

const OutcomeBadge = ({ outcome, net }) => {
  const map = {
    win: { icon: Trophy, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'You won' },
    loss: { icon: Frown, cls: 'text-rose-400 bg-rose-500/10 border-rose-500/30', label: 'You lost' },
    tie: { icon: Minus, cls: 'text-slate-300 bg-slate-500/10 border-slate-500/30', label: 'Split pot' },
  }[outcome] || {};
  const Icon = map.icon || Minus;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold ${map.cls}`}>
      <Icon className="h-5 w-5" />
      <span>{map.label}</span>
      <span className="tabular-nums">{net > 0 ? `+${net}` : net} BB</span>
    </div>
  );
};

// Renders the server's EV grade of the hero's last decision — the whole point of
// the exercise is that this is judged independently of whether the hand was won.
const DecisionFeedback = ({ observation }) => {
  if (!observation) return null;
  const good = observation.correct;
  return (
    <div className={`flex items-start gap-2 text-sm p-3 rounded-xl border ${
      good ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5'
           : 'text-amber-300 border-amber-500/30 bg-amber-500/5'}`}>
      {good ? <TrendingUp className="h-4 w-4 mt-0.5 shrink-0" /> : <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />}
      <span>
        <strong>{SKILL_LABELS[observation.skill] || observation.skill}:</strong>{' '}
        {good ? 'solid decision' : 'leak spotted'} — EV loss {observation.ev_loss_bb} BB.
      </span>
    </div>
  );
};

const HeadsUpArena = ({ user, onLogout }) => {
  const [profile, setProfile] = useState('balanced');
  const [handId, setHandId] = useState(null);
  const [frame, setFrame] = useState(null);
  const [lastObservation, setLastObservation] = useState(null);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startHand = useCallback(async () => {
    setLoading(true);
    setError('');
    setLastObservation(null);
    setComplete(false);
    try {
      const data = await pokerService.startHand(profile);
      setHandId(data.hand_id);
      setFrame(data.frame);
    } catch {
      setError('Could not deal a new hand. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const act = async (action) => {
    if (busy || complete) return;
    setBusy(true);
    setError('');
    try {
      const data = await pokerService.submitHandAction(handId, action);
      setFrame(data.frame);
      setLastObservation(data.observation);
      setComplete(data.complete);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'That action was rejected. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const result = complete ? frame?.result : null;

  return (
    <PageLayout onLogout={onLogout} user={user}>
      {/* Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg">
            <Swords className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Heads Up Arena</h2>
            <p className="text-slate-400 mt-1 text-sm max-w-xl leading-relaxed">
              Heads-up hands vs a tunable bot. Every decision is graded on EV — independent of whether the hand is won.
            </p>
          </div>
        </div>
        <Link
          to="/arena/stats"
          className="flex items-center gap-2 self-start md:self-center text-sm font-semibold text-slate-300 border border-slate-700 hover:border-indigo-500/50 hover:text-indigo-300 px-4 py-2.5 rounded-lg transition"
        >
          <BarChart3 className="h-4 w-4" /> Session stats
        </Link>
      </section>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-4 rounded-xl flex items-center gap-2 mb-6">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No active hand: opponent picker + deal button */}
      {!frame && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-lg font-bold text-slate-100 mb-4">Choose your opponent</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {PROFILES.map((p) => (
              <button
                key={p.key}
                onClick={() => setProfile(p.key)}
                className={`text-left p-4 rounded-2xl border transition ${
                  profile === p.key
                    ? 'border-rose-500/70 bg-rose-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-slate-100">{p.label}</div>
                <div className="text-xs text-slate-400 mt-1">{p.blurb}</div>
              </button>
            ))}
          </div>
          <button
            onClick={startHand}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {loading ? 'Dealing...' : 'Deal a hand'}
          </button>
        </div>
      )}

      {/* Active hand */}
      {frame && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <PokerTable frame={frame} seats={SEATS} hero={HERO} button={BUTTON} />

          <DecisionFeedback observation={lastObservation} />

          {/* Action controls or end-of-hand summary */}
          {complete ? (
            <div className="border-t border-slate-800 pt-6 flex flex-col items-center gap-4">
              {result && <OutcomeBadge outcome={result.outcome} net={result.hero_net_bb} />}
              {result && (
                <p className="text-sm text-slate-400">
                  Bot held <span className="font-bold text-slate-200">{result.villain_cards.join(' ')}</span>.
                </p>
              )}
              <button
                onClick={startHand}
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-6 py-2.5 rounded-xl disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
              >
                <Swords className="h-4 w-4" /> Next hand
              </button>
            </div>
          ) : (
            frame.kind === 'decision' && (
              <div className="border-t border-slate-800 pt-6">
                <ActionBar legal={frame.legal_actions || []} busy={busy} onAct={act} />
              </div>
            )
          )}
        </div>
      )}
    </PageLayout>
  );
};

export default HeadsUpArena;
