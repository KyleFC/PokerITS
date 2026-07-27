import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, BookOpen, Zap, Users, DollarSign, Award } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import PokerCard from '../components/PokerCard';
import TableSequence from '../components/tutorial/TableSequence';
import ActionExplorer from '../components/tutorial/ActionExplorer';
import {
  SEATS,
  HERO,
  BUTTON,
  DEAL_FRAMES,
  FLOP_FRAMES,
  TURN_FRAMES,
  RIVER_FRAMES,
} from '../components/tutorial/sequences';

const Tutorial = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('intro');

  const sections = [
    { id: 'intro', title: 'Introduction', icon: BookOpen },
    { id: 'basics', title: 'Game Basics', icon: Zap },
    { id: 'hands', title: 'Hand Rankings', icon: Award },
    { id: 'position', title: 'Position Strategy', icon: Users },
    { id: 'betting', title: 'Betting Mechanics', icon: DollarSign },
  ];

  const handlePrevious = () => {
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex > 0) {
      setActiveSection(sections[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    const currentIndex = sections.findIndex(s => s.id === activeSection);
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1].id);
    }
  };

  const currentSectionIndex = sections.findIndex(s => s.id === activeSection);
  const CurrentIcon = sections[currentSectionIndex]?.icon || BookOpen;

  return (
    <PageLayout onLogout={onLogout} user={user}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-4 py-2">Tutorial Sections</h3>
            {sections.map((section, idx) => {
              const SectionIcon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeSection === section.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                  <SectionIcon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-8 md:p-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-600/20 rounded-lg">
                <CurrentIcon className="h-6 w-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">{sections[currentSectionIndex]?.title}</h1>
            </div>

            {/* Content */}
            <div className="text-slate-200 leading-relaxed space-y-6">
              {activeSection === 'intro' && <IntroContent />}
              {activeSection === 'basics' && <BasicsContent />}
              {activeSection === 'hands' && <HandRankingsContent />}
              {activeSection === 'position' && <PositionContent />}
              {activeSection === 'betting' && <BettingContent />}
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mt-12 pt-8 border-t border-slate-700">
              <button
                onClick={handlePrevious}
                disabled={currentSectionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <div className="flex-1" />
              <button
                onClick={handleNext}
                disabled={currentSectionIndex === sections.length - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

// Content Components
const IntroContent = () => (
  <>
    <p className="text-lg">
      Welcome to No-Limit Texas Hold'em! This tutorial will teach you everything you need to know to start playing poker.
    </p>

    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6 space-y-4">
      <h3 className="font-bold text-indigo-300 text-lg">What You'll Learn</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Game Basics:</strong> Hand structure, betting rounds, and terminology</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Hand Rankings:</strong> Which hands win in showdown</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Position Strategy:</strong> Why where you sit matters</span>
        </li>
        <li className="flex gap-3">
          <span className="text-indigo-400">•</span>
          <span><strong>Betting Mechanics:</strong> Types of bets and pot odds</span>
        </li>
      </ul>
    </div>

    <h3 className="font-bold text-lg text-white mt-6">Why No-Limit Hold'em?</h3>
    <p>
      No-Limit Hold'em is the most popular poker variant in the world. It's played in casinos, home games, and online. The "no-limit" means you can bet any amount at any time, making it the most dynamic and strategic form of poker.
    </p>

  </>
);

const BasicsContent = () => (
  <>
    <h3 className="font-bold text-lg text-white">How a Hand Works</h3>
    <p>
      Every poker hand follows the same structure. Each player starts with private cards, and then community cards are revealed in stages. The animations below play out one full hand — watch it, or step through it with the dots.
    </p>

    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold text-indigo-300 mb-3">1. The Deal (Preflop)</h4>
          <p className="text-sm mb-2">Each player receives 2 private cards (called "hole cards") that only they can see.</p>
          <p className="text-xs text-slate-400">The first player after the big blind acts first. The action moves clockwise.</p>
        </div>
        <TableSequence
          title="Watch: the deal"
          seats={SEATS}
          hero={HERO}
          button={BUTTON}
          frames={DEAL_FRAMES}
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold text-indigo-300 mb-3">2. The Flop</h4>
          <p className="text-sm mb-2">Three community cards are revealed in the center of the table. Everyone can use these cards.</p>
          <p className="text-xs text-slate-400">Players can now make a 5-card hand using their 2 cards + any 3 of the 5 community cards.</p>
        </div>
        <TableSequence
          title="Watch: the flop"
          seats={SEATS}
          hero={HERO}
          button={BUTTON}
          frames={FLOP_FRAMES}
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold text-indigo-300 mb-3">3. The Turn</h4>
          <p className="text-sm mb-2">A fourth community card is revealed.</p>
          <p className="text-xs text-slate-400">Now 6 cards are available to make the best 5-card hand.</p>
        </div>
        <TableSequence
          title="Watch: the turn"
          seats={SEATS}
          hero={HERO}
          button={BUTTON}
          frames={TURN_FRAMES}
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold text-indigo-300 mb-3">4. The River</h4>
          <p className="text-sm mb-2">The fifth and final community card is revealed.</p>
          <p className="text-xs text-slate-400">Now all 7 cards are visible. Players form their best 5-card hand.</p>
        </div>
        <TableSequence
          title="Watch: the river"
          seats={SEATS}
          hero={HERO}
          button={BUTTON}
          frames={RIVER_FRAMES}
        />
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mt-6">Your Turn: What Each Action Does</h3>
    <p className="text-sm">
      "The action moves clockwise" only tells you the order. What actually happens depends on which of five things you do when it reaches you. Pick one and watch it play out — including who acts next, and what it costs them.
    </p>

    <ActionExplorer />

    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-5">
      <p className="text-sm">
        <strong className="text-indigo-200">When does a betting round end?</strong> When everyone still in the hand has had a turn <em>and</em> everyone has put in the same amount. If a raise comes in behind you, the action keeps going around until that is true — then the next community card comes out and a new round starts.
      </p>
    </div>

    <h3 className="font-bold text-lg text-white mt-6">Key Terminology</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Fold</p>
        <p className="text-xs text-slate-400">Give up your hand and lose all money in the pot</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Check</p>
        <p className="text-xs text-slate-400">Pass without betting (only if no one has bet yet)</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Call</p>
        <p className="text-xs text-slate-400">Match the current bet amount</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Raise</p>
        <p className="text-xs text-slate-400">Increase the bet amount</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">All-In</p>
        <p className="text-xs text-slate-400">Bet all remaining chips</p>
      </div>
      <div className="bg-slate-800/30 p-4 rounded-lg">
        <p className="font-semibold text-slate-100 text-sm mb-1">Pot</p>
        <p className="text-xs text-slate-400">The total money in the middle of the table</p>
      </div>
    </div>
  </>
);

const HandRankingsContent = () => (
  <>
    <p className="mb-6">
      At showdown (when all betting is complete), the player with the best 5-card hand wins the pot. Here are all poker hands ranked from strongest to weakest:
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[
        { rank: 1, name: 'Royal Flush', desc: 'A-K-Q-J-10 same suit', example: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'] },
        { rank: 2, name: 'Straight Flush', desc: '5 cards in sequence, same suit', example: ['9s', '8s', '7s', '6s', '5s'] },
        { rank: 3, name: 'Four of a Kind', desc: 'Four cards same rank', example: ['Kh', 'Kd', 'Ks', 'Kc', 'Qh'] },
        { rank: 4, name: 'Full House', desc: 'Three of a kind + pair', example: ['Qh', 'Qd', 'Qs', '7c', '7h'] },
        { rank: 5, name: 'Flush', desc: '5 cards same suit', example: ['Kc', 'Jc', '9c', '5c', '3c'] },
        { rank: 6, name: 'Straight', desc: '5 cards in sequence', example: ['Th', '9d', '8s', '7c', '6h'] },
        { rank: 7, name: 'Three of a Kind', desc: 'Three cards same rank', example: ['8h', '8d', '8s', 'Kc', 'Jh'] },
        { rank: 8, name: 'Two Pair', desc: 'Two pairs of cards', example: ['Jh', 'Jd', '5s', '5c', '2h'] },
        { rank: 9, name: 'One Pair', desc: 'Two cards same rank', example: ['4h', '4d', 'As', 'Kc', 'Qh'] },
        { rank: 10, name: 'High Card', desc: 'No combination', example: ['Kh', 'Jd', '9s', '6c', '3h'] },
      ].map(({ rank, name, desc, example }) => (
        <div key={rank} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-start gap-3">
          <span className="w-7 h-7 shrink-0 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 tabular-nums">
            {rank}
          </span>
          <div>
            <h4 className="font-bold text-slate-100 mb-1">{name}</h4>
            <p className="text-sm text-slate-400 mb-2">{desc}</p>
            <div className="flex gap-1">
              {example.map((card) => (
                <PokerCard key={card} value={card} size="sm" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>

  </>
);

const PositionContent = () => (
  <>
    <p className="mb-6">
      Position—where you sit relative to other players—is one of the most important concepts in poker. Acting last is a huge advantage because you see what everyone else does before deciding.
    </p>

    <h3 className="font-bold text-lg text-white mb-4">The Three Positions</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-rose-300 text-lg mb-3">Early Position (Worst)</h4>
        <p className="text-sm mb-3">Sitting right after the big blind. You act first and know the least about what others will do.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>✕ Disadvantage:</strong> Everyone will act after you</p>
          <p><strong>✓ Strategy:</strong> Play only strong hands (top 15%)</p>
          <p><strong>Example hands:</strong> AA, KK, QQ, AK, AQ</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-amber-300 text-lg mb-3">Middle Position (Moderate)</h4>
        <p className="text-sm mb-3">Sitting in the middle of the action. Some players act before you, some after.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>⚖ Trade-off:</strong> Less advantage than button, more than early</p>
          <p><strong>✓ Strategy:</strong> Play better hands (top 20%)</p>
          <p><strong>Example hands:</strong> AA-JJ, AK, AQ, KQ</p>
        </div>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-emerald-300 text-lg mb-3">Late Position (Best)</h4>
        <p className="text-sm mb-3">The button (last to act). You have the biggest advantage—see everyone's actions first.</p>
        <div className="bg-slate-800/40 rounded p-4 text-sm space-y-2">
          <p><strong>✓ Advantage:</strong> Last to act on every betting round</p>
          <p><strong>✓ Strategy:</strong> Play wider range of hands (top 30%)</p>
          <p><strong>Example hands:</strong> Any pair, AJ+, KJ, QJ, etc.</p>
        </div>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Why Position Matters</h3>
    <div className="bg-slate-800/40 rounded-lg p-6 space-y-4">
      <div className="border-l-2 border-slate-700 pl-4">
        <p className="font-semibold text-slate-100 mb-1">Information Advantage</p>
        <p className="text-sm text-slate-300">Acting last means you know what everyone does before you decide</p>
      </div>
      <div className="border-l-2 border-slate-700 pl-4">
        <p className="font-semibold text-slate-100 mb-1">Control the Pot Size</p>
        <p className="text-sm text-slate-300">You can check behind (not bet) to keep the pot small, or bet large to build it</p>
      </div>
      <div className="border-l-2 border-slate-700 pl-4">
        <p className="font-semibold text-slate-100 mb-1">Steal Blinds</p>
        <p className="text-sm text-slate-300">From late position, you can raise weak hands hoping others fold</p>
      </div>
    </div>

  </>
);

const BettingContent = () => (
  <>
    <p className="mb-6">
      Understanding betting mechanics is crucial. Poker is a game of making +EV (positive expected value) decisions, which often involves understanding pot odds.
    </p>

    <h3 className="font-bold text-lg text-white mb-4">Types of Bets</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Bet</h4>
        <p className="text-sm text-slate-300">First person to put money in during a betting round</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Check</h4>
        <p className="text-sm text-slate-300">Pass without betting (only available if no one has bet yet)</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Call</h4>
        <p className="text-sm text-slate-300">Match the current bet to stay in the hand</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Raise</h4>
        <p className="text-sm text-slate-300">Increase the bet amount. Others must then call the new amount or fold</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
        <h4 className="font-semibold text-indigo-300 mb-2">Fold</h4>
        <p className="text-sm text-slate-300">Give up your hand and lose all chips already in the pot</p>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Pot Odds (Essential Concept)</h3>
    <p className="mb-4">
      Pot odds tell you the ratio of money in the pot compared to how much you need to call. This helps you decide if calling is profitable.
    </p>

    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-6 mb-6">
      <p className="text-sm font-mono text-indigo-200 mb-4">
        <strong>Pot Odds = (Money in pot) ÷ (Cost to call)</strong>
      </p>
      <p className="text-sm text-slate-300 mb-4">
        <strong>Example:</strong> Pot has $100. Opponent bets $20. You need to call $20. <br />
        Pot odds = $120 ÷ $20 = 6:1
      </p>
      <p className="text-sm text-indigo-200">
        This means if your hand wins more than 1 out of every 6 times you're in this situation, it's +EV (profitable) to call.
      </p>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">Hand vs. Range Thinking</h3>

    <div className="space-y-4 mb-8">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-rose-300 mb-3">Beginner Thinking</h4>
        <p className="text-sm text-slate-300">"What hand does my opponent have?"</p>
        <p className="text-xs text-slate-400 mt-2">Problem: You can't know their exact hand—you need to think about all possible hands they could have</p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
        <h4 className="font-semibold text-emerald-300 mb-3">Advanced Thinking</h4>
        <p className="text-sm text-slate-300">"What range of hands could my opponent have?"</p>
        <p className="text-xs text-slate-400 mt-2">Better approach: Consider the most likely hands based on their betting pattern</p>
      </div>
    </div>

    <h3 className="font-bold text-lg text-white mb-4">The 3 Reasons to Bet</h3>

    <div className="space-y-4">
      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">1</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Value Betting</p>
          <p className="text-sm text-slate-300">Bet to win money when you have a strong hand. Opponents call with weaker hands.</p>
        </div>
      </div>

      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">2</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Bluffing</p>
          <p className="text-sm text-slate-300">Bet with a weak hand hoping opponents fold. You win the pot without showdown.</p>
        </div>
      </div>

      <div className="flex gap-4 bg-slate-800/30 p-5 rounded-lg">
        <div className="text-2xl font-bold text-indigo-400 min-w-8">3</div>
        <div>
          <p className="font-semibold text-slate-100 mb-1">Protection / Semi-Bluff</p>
          <p className="text-sm text-slate-300">Bet with a drawing hand (one that could improve). You win now or improve to win later.</p>
        </div>
      </div>
    </div>

  </>
);

export default Tutorial;
